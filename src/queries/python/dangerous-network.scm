; Tree-sitter queries for dangerous network operations in Python
; These patterns detect network requests that could lead to SSRF,
; data exfiltration, or connections to untrusted hosts

; Network requests with variable URLs (potential SSRF)
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @method)
    arguments: (argument_list 
      (identifier) @url_var))
  (#eq? @mod "requests")
  (#match? @method "^(get|post|put|delete|patch|head)$")) @warn.net

; requests.* with dynamic URL expressions
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @method)
    arguments: (argument_list 
      (binary_operator) @url_expr))
  (#eq? @mod "requests")
  (#match? @method "^(get|post|put|delete|patch|head)$")) @warn.net

; urllib.request.urlopen with variable or dynamic URL
((
  call
    function: (attribute 
      object: (attribute object: (identifier) @mod attribute: (identifier) @pkg)
      attribute: (identifier) @method)
    arguments: (argument_list (identifier) @url_var))
  (#eq? @mod "urllib")
  (#eq? @pkg "request")
  (#eq? @method "urlopen")) @warn.net

((
  call
    function: (attribute 
      object: (attribute object: (identifier) @mod attribute: (identifier) @pkg)
      attribute: (identifier) @method)
    arguments: (argument_list (binary_operator) @url_expr))
  (#eq? @mod "urllib")
  (#eq? @pkg "request")
  (#eq? @method "urlopen")) @warn.net

; http.client.HTTP(S)Connection(...).request(...)
((
  call
    function: (attribute
      object: (call
        function: (attribute
          object: (attribute object: (identifier) @http attribute: (identifier) @client)
          attribute: (identifier) @conn_type)
        arguments: (argument_list . (_)*))
      attribute: (identifier) @method)
    arguments: (argument_list . (_)*))
  (#eq? @http "http")
  (#eq? @client "client")
  (#match? @conn_type "^(HTTPConnection|HTTPSConnection)$")
  (#eq? @method "request")) @warn.net

; socket.socket(...).connect((host, port))
((
  call
    function: (attribute
      object: (call
        function: (attribute object: (identifier) @mod attribute: (identifier) @ctor)
        arguments: (argument_list . (_)*))
      attribute: (identifier) @method)
    arguments: (argument_list (tuple . (_)*)))
  (#eq? @mod "socket")
  (#eq? @ctor "socket")
  (#match? @method "^connect(_ex)?$")) @warn.net