import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import worker from './dist/server/index.js';

const database = new DatabaseSync(process.env.FORMA_DB || 'viewings.sqlite');
const DB = {
  prepare(sql) {
    const statement = database.prepare(sql);
    let parameters = [];
    return {
      bind(...values) { parameters = values; return this; },
      all() { return {results: statement.all(...parameters)}; },
      run() { return {meta: statement.run(...parameters)}; }
    };
  }
};
const port = Number(process.env.PORT || 3000);
createServer(async (incoming, outgoing) => {
  try {
    const options = {method:incoming.method, headers:incoming.headers};
    if (!['GET','HEAD'].includes(incoming.method)) {
      options.body = Readable.toWeb(incoming);
      options.duplex = 'half';
    }
    const request = new Request(new URL(incoming.url,'http://localhost'),options);
    const response = await worker.fetch(request,{DB});
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500);
    outgoing.end('Request could not be completed.');
  }
}).listen(port, () => console.log('Forma is available on port '+port));
