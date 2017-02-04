Maildir file size fixer
=======================

This tool will attempt to locate file with invalid S= flag and correct it.
It also detects files that were gzipped twice accidentally and fixes that.

!!! WARNING !!!
---------------

It doesn't do any locking. It tampers with filenames and content.
THIS THING WILL PROBABLY SET YOUR SERVER ON FIRE

You have been warned. Use at own risk, read the code...

Potentially should be combined with `maildirlock`, but my FS doesn't support hard links, so I could not get it to work.

You might want to shut down your LDA and Dovecot when you're doing this to avoid clashes and other shenanigans.

Requirements
------------

nodejs >= 7.0

Installation
------------

* Clone from git
* Run `npm install`

Usage
-----

If you see scary errors in your dovecot error log like `Error: Maildir filename has wrong S value` and other ones complaining about `dovecot.index.log` errors,
note the mailbox for which it is happening, navigate to it in the file system and run this tool. It works out of `CWD`. Run from the mailbox root.
As in if you do `ls` you should see the `{cur,new,tmp}` folders.

Only works on one mailbox at a time.

You should probably run `doveadm index -u <username> <mailbox name>` after you're done.

Pull requests welcome.
ENJOY!
