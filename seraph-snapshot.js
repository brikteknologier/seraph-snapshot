var seraph = require('seraph');
var async = require('async');
var _ = require('underscore');

var fetchdb = [
  'MATCH node',
  'OPTIONAL MATCH node-[rel]-x',
  'RETURN node, labels(node) as labels, collect(rel) as rels'
].join(' ');

function dbToJSON(db, cb) {
  db.query(fetchdb, function(err, data) {
    if (err) return cb(err);
    var normalized = {};
    data.forEach(function(row) {
      normalized['node_'+row.node.id] = {
        type: 'node',
        labels: row.labels,
        data: row.node
      };
      row.rels.forEach(function(rel) {
        normalized['rel_'+rel.id] = {
          type: 'rel',
          data: rel
        };
      });
    });
    cb(null, normalized);
  });
}

function JSONtoStatementList(data) {
  var keys = Object.keys(data);
  var nodes = keys.filter(function(key) {
    return data[key].type == 'node';
  });
  var rels = keys.filter(function(key) {
    return data[key].type == 'rel';
  });
  var keymap = {};
  // can't use query params as we're exporting to a single string
  function createParamString(obj) {
    var kvs = Object.keys(obj).map(function(key) {
      return key + ':' + JSON.stringify(obj[key]);
    }).join(',');
    return '{' + kvs + '}';
  }
  var uniqueNameIndex = 0;
  function createUniqueName(type) {
    return type + (uniqueNameIndex++);
  }
  var creates = [];
  nodes.forEach(function(nodeKey) {
    var node = data[nodeKey];
    delete node.data.id;
    var name = keymap[nodeKey] = createUniqueName('node');
    var params = createParamString(node.data);
    var labels = node.labels.map(function(l) { return ':`' + l + '`' }).join('');
    creates.push({ 
      statement: '(' + name + labels + ' ' + params + ')', 
      refs:[],
      id: name
    });
  });
  rels.forEach(function(relKey) {
    var rel = data[relKey];
    var name = keymap[relKey] = createUniqueName('rel');
    var params = createParamString(rel.data.properties);
    var start = keymap["node_" + rel.data.start];
    var finish = keymap["node_" + rel.data.end];
    var type = '`' + rel.data.type + '`';
    creates.push({
      statement: start + '-[' + name + ':' + type + ' ' + params + ']->' + finish,
      refs:[start,finish],
      id: name
    }); 
  });
  return creates;
};

function restoreTransactional(db, data, cb) {
  var statements = JSONtoStatementList(data);
  var stepSize = 15;
  var nodeMap = {};
  var groups = [];
  var txn;
  
  for (var i = 0; i < statements.length; i += 15) {
    groups.push(statements.slice(i, i + 15));
  }

  async.forEachSeries(groups, function(s,cb) {
    var start = _.chain(s).pluck('refs').flatten().uniq().map(function(ref) {
        return ref + '=node(' + nodeMap[ref] + ')';
    }).value().join(',')
    var query = start ? 'START ' + start : '';
    query += ' CREATE ' + s.map(function(row) { return row.statement }).join(',');
    query += ' RETURN ' + s.map(function(row) { return 'id(' + row.id + ') as ' + row.id }).join(',');
    var endpoint = txn || 'transaction';
    var op = db.operation(endpoint, 'POST', {
      statements: [{ statement:query }]
    });
    db.call(op, function(err, result, transLoc) {
      if (err) return cb(err);
      // see how enterprise.
      if (!txn) txn = require('url').parse(transLoc).path.replace(db.options.endpoint + '/', '');
      var keys = result.results[0].columns;
      var vals = result.results[0].data[0].row;
      keys.forEach(function(key, i) {
        nodeMap[key] = vals[i];
      });

      cb();
    });
  }, function(e) {
    if (e) return cb(e);
    var op = db.operation(txn + '/commit', 'POST', {statements:[]});
    db.call(op, cb);
  });
}

function JSONtoCypher(data) {
  return 'CREATE ' + JSONtoStatementList(data).map(function(s) { return s.statement }).join(',')
}

module.exports = {
  json: dbToJSON,
  jsonToCypher: JSONtoCypher,
  restoreTransactional: restoreTransactional,
  cypher: function(db, cb) {
    dbToJSON(db, function(err, data) {
      if (err) return cb(err);
      else cb(null, JSONtoCypher(data));
    });
  }
}
