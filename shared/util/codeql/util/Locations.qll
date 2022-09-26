/** Provides classes for working with locations. */
signature module LocationsSig {
  class File_;

  class AtLocation;

  predicate locations(
    AtLocation loc, File_ file, int startLine, int startColum, int endLine, int endColumn
  );

  string getAbsolutePath(File_ file);
}

module Make<LocationsSig Input> {
  /**
   * A location as given by a file, a start line, a start column,
   * an end line, and an end column.
   *
   * For more information about locations see [LGTM locations](https://codeql.github.com/docs/writing-codeql-queries/providing-locations-in-codeql-queries/).
   */
  class Location instanceof Input::AtLocation {
    /** Gets the file for this location. */
    Input::File_ getFile() { Input::locations(this, result, _, _, _, _) }

    /** Gets the 1-based line number (inclusive) where this location starts. */
    int getStartLine() { Input::locations(this, _, result, _, _, _) }

    /** Gets the 1-based column number (inclusive) where this location starts. */
    int getStartColumn() { Input::locations(this, _, _, result, _, _) }

    /** Gets the 1-based line number (inclusive) where this location ends. */
    int getEndLine() { Input::locations(this, _, _, _, result, _) }

    /** Gets the 1-based column number (inclusive) where this location ends. */
    int getEndColumn() { Input::locations(this, _, _, _, _, result) }

    /** Gets the number of lines covered by this location. */
    int getNumLines() { result = this.getEndLine() - this.getStartLine() + 1 }

    /** Gets a textual representation of this element. */
    string toString() {
      exists(string filepath, int startline, int startcolumn, int endline, int endcolumn |
        this.hasLocationInfo(filepath, startline, startcolumn, endline, endcolumn) and
        result = filepath + "@" + startline + ":" + startcolumn + ":" + endline + ":" + endcolumn
      )
    }

    /**
     * Holds if this element is at the specified location.
     * The location spans column `startcolumn` of line `startline` to
     * column `endcolumn` of line `endline` in file `filepath`.
     * For more information, see
     * [LGTM locations](https://codeql.github.com/docs/writing-codeql-queries/providing-locations-in-codeql-queries/).
     */
    predicate hasLocationInfo(
      string filepath, int startline, int startcolumn, int endline, int endcolumn
    ) {
      exists(Input::File_ f |
        Input::locations(this, f, startline, startcolumn, endline, endcolumn) and
        filepath = Input::getAbsolutePath(f)
      )
    }

    /** Holds if this location starts strictly before the specified location. */
    pragma[inline]
    predicate strictlyBefore(Location other) {
      this.getStartLine() < other.getStartLine()
      or
      this.getStartLine() = other.getStartLine() and this.getStartColumn() < other.getStartColumn()
    }
  }

  /** An entity representing an empty location. */
  class EmptyLocation extends Location {
    EmptyLocation() { this.hasLocationInfo("", 0, 0, 0, 0) }
  }
}
