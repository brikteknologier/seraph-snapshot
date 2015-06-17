var seraph = require('seraph');
var async = require('async');

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

function restoreTransactional(db, data) {
  var statements = JSONtoStatementList(data);
  var stepSize = 15;
  var nodeMap = {};
  var groups = [];
  var txn;
  
  for (var i = 0; i < data.length; i += 15) {
    groups.push(data.slice(i, i + 15));
  }

  async.forEachSeries(groups, function(s,cb) {
    var start = s.reduce(function(start, row) {
      if (row.refs.length == 0) return start;
      else return start.concat(row.refs.map(function(ref) {
        return ref + '=node(' + nodeMap[ref] + ')';
      }));
    }, []).join(',');
    var query = start ? 'START ' + start : '';
    query += 'CREATE ' + s.map(function(row) { return row.statement }).join(',');
    query += 'RETURN ' + s.map(function(row) { return 'id(' + row.id + ') as ' + row.id }).join(',');
    var endpoint = txn || 'transaction';
    var op = db.operation(endpoint, 'POST', {
      statements: [{ statement:query, resultDataContents: ['graph']}]
    });
    db.call(op, function(err, result) {
      if (err) return cb(err);
      // see how enterprise.
      result = result.result[0].data[0].graph.nodes;
    });
  });
}

function JSONtoCypher(data) {
  return 'CREATE ' + JSONtoStatementList(data).map(function(s) { return s.statement }).join(',')
}

module.exports = {
  json: dbToJSON,
  jsonToCypher: JSONtoCypher,
  cypher: function(db, cb) {
    dbToJSON(db, function(err, data) {
      if (err) return cb(err);
      else cb(null, JSONtoCypher(data));
    });
  }
}
