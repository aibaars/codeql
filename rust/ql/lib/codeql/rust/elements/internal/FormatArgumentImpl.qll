/**
 * This module provides a hand-modifiable wrapper around the generated class `FormatArgument`.
 *
 * INTERNAL: Do not use.
 */

private import codeql.rust.elements.internal.generated.FormatArgument
private import codeql.rust.elements.internal.generated.Raw
private import codeql.rust.elements.internal.generated.Synth
private import codeql.rust.elements.internal.FormatArgumentConstructor

/**
 * INTERNAL: This module contains the customizable definition of `FormatArgument` and should not
 * be referenced directly.
 */
module Impl {
  // the following QLdoc is generated: if you need to edit it, do it in the schema file
  /**
   * An argument in a format element in a formatting template. For example the `width`, `precision`, and `value` in:
   * ```rust
   * println!("Value {value:#width$.precision$}");
   * ```
   * or the `0`, `1` and `2` in:
   * ```rust
   * println!("Value {0:#1$.2$}", value, width, precision);
   * ```
   */
  class FormatArgument extends Generated::FormatArgument {
    Raw::FormatArgsExpr parent;
    int index;
    int kind;
    string name;
    private int offset;

    FormatArgument() { this = Synth::TFormatArgument(parent, index, kind, name, _, offset) }

    override string toString() { result = name }

    override predicate hasLocationInfo(
      string filepath, int startline, int startcolumn, int endline, int endcolumn
    ) {
      // TODO: handle locations in multi-line comments
      // TODO: handle the case where the template is from a nested macro call
      Synth::convertFormatArgsExprFromRaw(parent)
          .(FormatArgsExpr)
          .getTemplate()
          .getLocation()
          .hasLocationInfo(filepath, startline, startcolumn - offset, _, _) and
      endline = startline and
      endcolumn = startcolumn + name.length() - 1
    }

    override Format getParent() { result = Synth::TFormat(parent, index, _, _) }
  }

  /**
   * A positional `FormatArgument`. For example `0` in
   * ```rust
   * let name = "Alice";
   * println!("{0} in wonderland", name);
   * ```
   */
  class PositionalFormatArgument extends FormatArgument {
    PositionalFormatArgument() { this = Synth::TFormatArgument(_, _, _, _, true, _) }

    /** Gets the index of this positional argument */
    int getIndex() { result = name.toInt() }
  }

  /**
   * A named `FormatArgument`. For example `name` in
   * ```rust
   * let name = "Alice";
   * println!("{name} in wonderland");
   * ```
   */
  class NamedFormatArgument extends FormatArgument {
    NamedFormatArgument() { this = Synth::TFormatArgument(_, _, _, _, false, _) }

    /** Gets the name of this named argument */
    string getName() { result = name }
  }
}
