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

function JSONtoCypher(data) {
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
    creates.push('(' + name + labels + ' ' + params + ')');
  });
  rels.forEach(function(relKey) {
    var rel = data[relKey];
    var name = keymap[relKey] = createUniqueName('rel');
    var params = createParamString(rel.data.properties);
    var start = keymap["node_" + rel.data.start];
    var finish = keymap["node_" + rel.data.end];
    var type = '`' + rel.data.type + '`';
    creates.push(start + '-[' + name + ':' + type + ' ' + params + ']->' + finish); 
  });
  return 'CREATE ' + creates.join(',');
};

module.exports = {

}
