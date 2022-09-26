private import codeql.util.Locations as L
import codeql.files.FileSystem

private module LocationsImpl implements L::LocationsSig {
  class File_ = File;

  class AtLocation = @location_default;

  predicate locations(
    AtLocation loc, File file, int startLine, int startColum, int endLine, int endColumn
  ) {
    locations_default(loc, file, startLine, startColum, endLine, endColumn)
  }

  string getAbsolutePath(File f) { result = f.getAbsolutePath() }
}

import L::Make<LocationsImpl>
