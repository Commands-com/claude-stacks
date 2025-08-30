; Tree-sitter queries for dangerous execution patterns in JavaScript
; These patterns detect eval(), child_process operations, and dynamic code execution

; eval() function calls
((
  call_expression
    function: (identifier) @func
    arguments: (arguments))
  (#eq? @func "eval")) @danger.eval

; child_process.exec family
((
  call_expression
    function: (member_expression
      object: (identifier) @module
      property: (property_identifier) @method))
  (#eq? @module "child_process")
  (#match? @method "^(exec|spawn|fork|execFile)$")) @danger.exec

; require('child_process').exec
((
  call_expression
    function: (member_expression
      object: (call_expression
        function: (identifier) @require_func
        arguments: (arguments (string) @module_name))
      property: (property_identifier) @method))
  (#eq? @require_func "require")
  (#eq? @module_name "\"child_process\"")
  (#match? @method "^(exec|spawn|fork|execFile)$")) @danger.exec

; Function constructor
((
  new_expression
    constructor: (identifier) @constructor)
  (#eq? @constructor "Function")) @danger.eval