#!/usr/bin/node --harmony-async-await
const fs     = require('mz/fs');
const zlib   = require('mz/zlib');
const path   = require('path');
const colors = require('colors');
const status = require('node-status');

const GZIP_MAGIC    = '1f8b';
const MAILDIR_MAGIC = ':2,';

const resolvePath      = (...parts) => path.resolve(process.cwd(), 'cur', ...parts);
const isGzipCompressed = (buffer) => buffer.slice(0, 2).toString('hex') === GZIP_MAGIC;
const getRawSize       = (buffer) => buffer.readInt32LE(buffer.length-4);

const isTwiceCompressed = async (buffer) => {
  try {
    const unzipped = await zlib.unzip(buffer);
    const stillZipped = isGzipCompressed(unzipped);
    return stillZipped ? [ true, unzipped ] : [ false ];
  }
  catch(e) {
    return [ false ];
  }
};

status.start({
  pattern: 'Processing files {spinner} | {files} {files.bar} | Unsized: {unsized} | Invalid: {invalid} | Twice-compressed: {twice}'
});

(async () => {
  const files = await fs.readdir(resolvePath());

  const skip     = parseInt(process.argv[2], 10) || 0;

  const progress = status.addItem('files', { max: files.length, count: skip });
  const invalid  = status.addItem('invalid');
  const twice    = status.addItem('twice');
  const unsized  = status.addItem('unsized');


  for(var file of files.slice(skip)) {
    const console = status.console();
    progress.inc();
    const filePath = resolvePath(file);
    // console.log(`Processing ${filePath}`);

    const [bbase, fflags]  = file.split(MAILDIR_MAGIC);
    const [base, ...sizes] = bbase.split(',');
    const flags            = fflags.split(',');

    const sizesObj = sizes.reduce((acc, i) => {
      const [k,v] = i.split('=');
      return Object.assign(acc, { [k]: parseInt(v, 10) });
    }, {});

    if(!sizesObj.S) {
      unsized.inc();
      continue;
    }

    const stat = await fs.stat(filePath);

    // Only need to check if size doesn't match filesize

    if(stat.size === sizesObj.S) { continue; }

    const buffer = await fs.readFile(filePath);

    const { mode, atime, mtime, uid, gid } = stat;
    const isGzip = isGzipCompressed(buffer);

    const [twiceCompressed, unzipped] = await isTwiceCompressed(buffer);

    const newFlags = flags.filter(f => f !== 'Z').join(',');

    const rawSize = isGzip ? getRawSize(buffer) : stat.size;
    if(sizesObj.S !== rawSize) {
      invalid.inc();

      if(twiceCompressed) {
        twice.inc();
        console.log(`File ${filePath} is compressed twice`.red);

        const newSize  = `,S=${getRawSize(unzipped)}`;
        const fileName = `${base}${newSize}${MAILDIR_MAGIC}${newFlags}`;
        const tmpFile  = resolvePath('../tmp', fileName);

        try {
          await fs.writeFile(tmpFile, unzipped);
          await fs.utimes(tmpFile, atime, mtime);
          await fs.chown(tmpFile, uid, gid);

          await fs.unlink(filePath);
          await fs.rename(tmpFile, resolvePath(fileName));
        }
        catch(ex) {
          console.error(ex);
          process.exit(2);
        }
        continue;
      }

      console.log(`${isGzip ? 'C' : 'Unc'}ompressed ${file} size of ${rawSize} doesn't match flags ${sizesObj.S}`);

      const newSize  = `,S=${rawSize}`;
      const fileName = `${base}${newSize}${MAILDIR_MAGIC}${newFlags}`;
      const tmpName  = resolvePath(fileName);

      try {
        await fs.rename(filePath, tmpName);
        await fs.utimes(tmpName, atime, mtime);
        await fs.chown(tmpName, uid, gid);
      }
      catch(ex) {
        console.error(ex);
        process.exit(3);
      }
    }
  }
  setTimeout(() => {
    status.stop();
    console.log('\r\nDone');
  }, 250);
})().catch(ex => { console.error(ex); process.exit(1); });

