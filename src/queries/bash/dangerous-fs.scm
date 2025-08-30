; Tree-sitter queries for dangerous file system operations in Bash
; These patterns detect file operations that could be destructive
; or access sensitive system paths

; rm -rf
((
  command
    name: (command_name (word) @cmd)
    argument: (word) @arg)
  (#eq? @cmd "rm")
  (#match? @arg "^-.*r.*f.*$")) @danger.fsdelete

; redirect to sensitive paths
((
  redirected_statement
    redirect: (file_redirect
      descriptor: (_)
      destination: (word) @target))
  (#match? @target "^/(etc|dev|proc|sys)\b")) @danger.fswrite