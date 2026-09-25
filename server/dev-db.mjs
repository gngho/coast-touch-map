// Local preview/test adapter only. Hosted schema changes use packaged migrations.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function localDatabase(filename=':memory:'){
  const sqlite=new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY);');
  for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
    if(sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name))continue;
    sqlite.exec('BEGIN');try{sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(name);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
  }
  class Statement{
    constructor(sql,args=[]){this.sql=sql;this.args=args;}
    bind(...args){return new Statement(this.sql,args);}
    async first(){return sqlite.prepare(this.sql).get(...this.args)||null;}
    async all(){return {results:sqlite.prepare(this.sql).all(...this.args)};}
    execute(){const result=sqlite.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(result.changes)}};}
    async run(){return this.execute();}
  }
  return {prepare:sql=>new Statement(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const result=statements.map(s=>s.execute());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close:()=>sqlite.close()};
}
