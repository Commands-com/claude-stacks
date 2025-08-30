; Tree-sitter queries for dangerous network operations in TypeScript
; These patterns detect fetch, XMLHttpRequest, and other network requests

; fetch() calls with dynamic URLs
((
  call_expression
    function: (identifier) @func
    arguments: (arguments (identifier) @url_var))
  (#eq? @func "fetch")) @warn.net

; fetch() with template literals
((
  call_expression
    function: (identifier) @func
    arguments: (arguments (template_string) @url_template))
  (#eq? @func "fetch")) @warn.net

; XMLHttpRequest usage
((
  new_expression
    constructor: (identifier) @constructor)
  (#eq? @constructor "XMLHttpRequest")) @warn.net

; axios or other HTTP libraries
((
  call_expression
    function: (member_expression
      object: (identifier) @http_lib
      property: (property_identifier) @method))
  (#match? @http_lib "^(axios|request)$")
  (#match? @method "^(get|post|put|delete|patch)$")) @warn.net