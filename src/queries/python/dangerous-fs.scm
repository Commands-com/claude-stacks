; Tree-sitter queries for dangerous filesystem operations in Python
; These patterns detect file operations that could be potentially dangerous

; os.remove and os.unlink (file deletion)
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func))
  (#eq? @mod "os")
  (#match? @func "^(remove|unlink)$")) @warn.fs

; os.rmdir and shutil.rmtree (directory deletion)
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func))
  (#match? @mod "^(os|shutil)$")
  (#match? @func "^(rmdir|rmtree)$")) @danger.fs

; os.chmod (permission changes)
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func))
  (#eq? @mod "os")
  (#eq? @func "chmod")) @warn.fs

; os.chown (ownership changes)
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func))
  (#eq? @mod "os")
  (#eq? @func "chown")) @warn.fs

; pathlib.Path.unlink() (file deletion via pathlib)
((
  call
    function: (attribute
      object: (attribute
        object: (identifier) @pathlib
        attribute: (identifier))
      attribute: (identifier) @method))
  (#eq? @pathlib "pathlib")
  (#eq? @method "unlink")) @warn.fs

; open() with write modes that could overwrite files
((
  call
    function: (identifier) @func
    arguments: (argument_list
      (_)
      (string (string_content) @mode)))
  (#eq? @func "open")
  (#match? @mode "^(w|a|w\\+|a\\+|wb|ab)$")) @warn.fs

; tempfile operations
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func))
  (#eq? @mod "tempfile")
  (#match? @func "^(mktemp|mkstemp|mkdtemp)$")) @info.fs