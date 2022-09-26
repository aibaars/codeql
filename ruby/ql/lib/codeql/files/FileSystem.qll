private import codeql.util.FileSystem as F

private module FilesImpl implements F::FilesSig {
  class AtFile = @file;

  class AtContainer = @container;

  class AtFolder = @folder;

  predicate files_ = files/2;

  predicate folders_ = folders/2;

  predicate containerparent_ = containerparent/2;

  predicate sourceLocationPrefix_ = sourceLocationPrefix/1;
}

import F::Make<FilesImpl>
