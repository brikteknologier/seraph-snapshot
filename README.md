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

