// Requires Javascript
var setup_code = "";

$(document).ready(function(event) {

  // Calculate line numbers
  var line_count = 0;
  $('aside.code pre code#setup.language-javascript').each(function() {
    line_count = $(this).text().split("\n").length + 1
    setup_code = $(this).text();
  });


  if (setup_code == "") {
    setup_code = ['// Setup settings',
                  'var ChaosSettings = {',
                  '  "servicePath":"http://api.chaos-systems.com/",',
                  '  //"clientGUID":"9f62060c-64ff-e14f-a8d5-d85a1e2e21b8",',
                  '  "accessPointGUID":"C4C2B8DA-A980-11E1-814B-02CEA2621172",',
                  '};',
                  '// Instantiate client',
                  'var client = new PortalClient(',
                  '                   ChaosSettings.servicePath,',
                  '                   ChaosSettings.clientGUID',
                  ');'].join('\n');
    line_count = setup_code.split("\n").length + 1;
  }

  $('aside.code pre code').each(function() {
    var pre = $(this).parent();
    var code = $(this).html();
    var aside = pre.parent();

    // http://codemirror.net/doc/manual.html#api_configuration
    var CodeMirrorSettings = {
      value: code,
      lineNumbers: true,
      tabSize: 2,
    };

    // Save the <code> element
    codeElem = $(this).clone();

    // Make CodeMirror
    var textarea = $('<textarea>' + code + '</textarea>');
    pre.replaceWith(textarea);
    // var textarea = aside.children('textarea').get(0);
    var codeMirror = CodeMirror.fromTextArea(textarea.get(0), CodeMirrorSettings);
    aside.attr('id', codeElem.attr('id'));
    aside.data('codeMirror', codeMirror);

    // Setup CodeMirror
    if (codeElem.hasClass('language-html')) {
      codeMirror.setOption('mode', 'htmlmixed');
    } else if (codeElem.hasClass('language-json')) {
      codeMirror.setOption('mode', { 'name': 'javascript', 'json': true });
    } else if (codeElem.hasClass('language-javascript')) {
      codeMirror.setOption('mode', 'javascript');

      if (codeElem.hasClass("eval")) {
        codeMirror.setOption('firstLineNumber', line_count);

        // Add Javascript evaluate button
        var codeButton = $('<div class="try-code"><button>Try!<\/button><\/div>');
        codeButton.children('button').click(codeEval(codeMirror, setup_code));
        aside.append(codeButton);
      }
    }
  });

});

function codeEval(codeMirror, setup_code) {
  return function(event) {
    var code = codeMirror.getValue();

    // http://aaronrussell.co.uk/legacy/check-if-an-element-exists-using-jquery/
    if ($('#setup.code').length > 0) {
      setup_code = $('#setup.code').data('codeMirror').getValue();
    }

    // console.log(setup_code + code);
    eval(setup_code + code);
  };
}
