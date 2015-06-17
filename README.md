# seraph-snapshot

Takes a snapshot of a neo4j database, from node.js.

## Why?

Neo4j-community doesn't provide any good way to backup data without stopping the
database. While not perfect, this library aims to provide some kind of alternative
for those people using neo4j-community who can't afford a prohibitively expensive
neo4j license, and still want to backup their data. 

## Limitations

* Doesn't aim to provide any way to restore your data. It assumed that this will
be done manually, or through your own tools. 
* Only backs up nodes/labels and relationships. Legacy indexes and constraints
  are not included in the snapshot.

## Install

```
npm install seraph-snapshot
```

## Use

```javascript
var db = require('seraph')('http://localhost:7474')
var snapshot = require('seraph-snapshot');

snapshot.json(db, function(err, json) {
  // json == an object containing all of the nodes and relationships in the database
});
```

## API

### snapshot.json(db, cb)

* `db`: a seraph instance
* `cb (fn(err, obj))`: a function to call with the result.

Creates an object with all of the database's nodes and relationships in it. The
format goes something like this:

```json
{
  "node_1": {
    "type": "node",
    "labels": ["car"],
    "data": {
      "make": "Citroen",
      "model": "DS4",
      "year": 2011,
      "id": 1
    }
  },
  "node_2": {
    "type": "node",
    "labels": ["person"],
    "data": {
      "name": "Jon Packer",
      "age": 26,
      "id": 2
    }
  },
  "rel_1": {
    "type": "rel",
    "data": {
      "type": "OWNS",
      "start": 1,
      "end": 2,
      "properties": { "for": "3 years" },
      "id": 3
    }
  }
```

### snapshot.cypher(db, cb)

* `db`: a seraph instance
* `cb (fn(err, obj))`: a function to call with the result.

Creates a cypher query that will recreate all of the data in this database.

For example, for the database given in the snapshot.json example, this function would
return:

```cypher
CREATE (node0:`car` {make:"Citroen",model:"DS4",year:2011}),(node1:`person` {name:"Jon Packer",age:26}),node0-[rel2:`OWNS` {for:"3 years"}]->node1
```

### snapshot.jsonToCypher(json, stepSize)

* `json`: an object with data from the database, formatted in the way returned
          by `snapshot.json`.
* `stepSize`: optional - if set, return an array of CREATE queries with this many
              create statements in it

Converts an object represtation of a neo4j database to a cypher query that can
be used to recreate it.


## License

MIT
