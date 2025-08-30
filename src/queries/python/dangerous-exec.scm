; Tree-sitter queries for dangerous process execution patterns in Python
; These patterns detect subprocess usage, os.system calls, and eval/exec operations
; that could potentially execute arbitrary code or system commands

; Dangerous subprocess execution - only flag clearly dangerous patterns
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func)
    arguments: (argument_list 
      (list 
        (identifier) @cmd_var 
        . (_)*)))
  (#eq? @mod "subprocess")
  (#match? @func "^(run|Popen|call|check_call|check_output)$")) @danger.exec

; Subprocess execution with string first element in list
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func)
    arguments: (argument_list 
      (list 
        (string (string_content) @cmd_str)
        . (_)*)))
  (#eq? @mod "subprocess")
  (#match? @func "^(run|Popen|call|check_call|check_output)$")) @danger.exec

; Subprocess with shell=True and string (very dangerous)
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func)
    arguments: (argument_list
      (string (string_content) @cmd_str)
      (keyword_argument
        name: (identifier) @kwarg
        value: (true))))
  (#eq? @mod "subprocess")
  (#match? @func "^(run|Popen|call|check_call|check_output)$")
  (#eq? @kwarg "shell")) @danger.exec

; Subprocess with shell=True anywhere in arguments
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func)
    arguments: (argument_list (keyword_argument name: (identifier) @kwarg value: (true))))
  (#eq? @mod "subprocess")
  (#match? @func "^(run|Popen|call|check_call|check_output)$")
  (#eq? @kwarg "shell")) @danger.exec

; Subprocess with dangerous hardcoded commands
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func)
    arguments: (argument_list 
      (list 
        (string (string_content) @cmd))))
  (#eq? @mod "subprocess")
  (#match? @func "^(run|Popen|call|check_call|check_output)$")
  (#match? @cmd "^(rm|rmdir|dd|mkfs|fdisk|sudo|su|chmod|chown|kill|pkill)$")) @danger.exec

; os.system (always dangerous)
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func))
  (#eq? @mod "os")
  (#eq? @func "system")) @danger.exec

; os popen/exec family
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func))
  (#eq? @mod "os")
  (#match? @func "^(popen|execl|execle|execlp|execlpe|execv|execve|execvp|execvpe)$")) @danger.exec

; pexpect/pty spawn
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func))
  (#match? @mod "^(pexpect|pty)$")
  (#eq? @func "spawn")) @danger.exec

; eval/exec with variables (dangerous)
((
  call
    function: (identifier) @name
    arguments: (argument_list 
      (identifier))) 
  (#match? @name "^(eval|exec)$")) @danger.eval

; eval/exec with user input patterns
((
  call
    function: (identifier) @name
    arguments: (argument_list 
      (subscript))) 
  (#match? @name "^(eval|exec)$")) @danger.eval

; exec/eval with string concatenation or expressions
((
  call
    function: (identifier) @name
    arguments: (argument_list 
      (binary_operator)))
  (#match? @name "^(eval|exec)$")) @danger.eval