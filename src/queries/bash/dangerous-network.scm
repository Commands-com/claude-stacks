; Tree-sitter queries for dangerous network operations in Bash
; These patterns detect network-based execution that could lead to
; remote code execution or malicious script downloads

; curl|wget | sh|bash
((
  pipeline
    (command name: (command_name (word) @cmd1))
    (command name: (command_name (word) @cmd2)))
  (#match? @cmd1 "^(curl|wget)$")
  (#match? @cmd2 "^(sh|bash|zsh|dash|ksh|ash)$")) @danger.netexec