; Tree-sitter queries for dangerous execution patterns in TypeScript
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

; import * as cp from 'child_process'; cp.exec()
((
  call_expression
    function: (member_expression
      object: (identifier) @cp_alias
      property: (property_identifier) @method))
  (#match? @method "^(exec|spawn|fork|execFile)$")) @warn.exec

; Function constructor
((
  new_expression
    constructor: (identifier) @constructor)
  (#eq? @constructor "Function")) @danger.eval