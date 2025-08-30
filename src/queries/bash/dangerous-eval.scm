; Tree-sitter queries for dangerous evaluation patterns in Bash
; These patterns detect command evaluation that could execute arbitrary code

; sh -c "...$VAR..."
((
  command
    name: (command_name (word) @name)
    argument: (word) @flag)
  (#match? @name "^(sh|bash|zsh|dash|ksh|ash)$")
  (#eq? @flag "-c")) @danger.eval

; eval builtin
((
  command
    name: (command_name (word) @cmd))
  (#eq? @cmd "eval")) @danger.eval