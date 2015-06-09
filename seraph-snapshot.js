function dbToJSON(db, callback) {
  var fetchdb = [
    'MATCH node',
    'OPTIONAL MATCH node-[rel]-x',
    'RETURN node, labels(node) as labels, collect(rel) as rels'
  ].join(' ');
}

module.exports = {

}
