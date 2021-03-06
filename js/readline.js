(function() {
  var SPECIAL = {
    8: 'BACKSPACE',
    9: 'TAB',
    13: 'ENTER',
    19: 'PAUSE',
    20: 'CAPS_LOCK',
    27: 'ESCAPE',
    32: 'SPACE',
    33: 'PAGE_UP',
    34: 'PAGE_DOWN',
    35: 'END',
    36: 'HOME',
    37: 'LEFT',
    38: 'UP',
    39: 'RIGHT',
    40: 'DOWN',
    45: 'INSERT',
    46: 'DELETE'
  };

  ReadLine = function(config) {
    config = config || {};

    // instance fields
    var _window = config.window || window;
    var _document = config.document || document;
    var _history = config.history || new ReadLine.History();
    var _active = false;
    var _onCompletion;
    var _onEnter;
    var _onKeydown;
    var _onChange;
    var _text = '';
    var _cursor = 0;
    var _strUtil = ReadLine.StrUtil;
    var _kill_buffer = '';
    var _lastCmd;
    var _completionActive;
    var _cmdQueue = [];
    var _suspended = false;

    // public methods
    var self = {
      activate: function() {
        _active = true;
      },
      deactivate: function() {
        _active = false;
      },
      onKeydown: function(keydownHandler) {
        _onKeydown = keydownHandler;
      },
      onChange: function(changeHandler) {
        _onChange = changeHandler;
      },
      onEnter: function(enterHandler) {
        _onEnter = enterHandler;
      },
      onCompletion: function(completionHandler) {
        _onCompletion = completionHandler;
      },
      getLine: function() {
        return {
          text: _text,
          cursor: _cursor
        };
      }
    };

    // private methods
    function getKeyInfo(e) {
      var info = {
        code: e.keyCode,
        shift: e.shiftKey,
        control: e.controlKey,
        alt: e.altKey,
        isChar: true
      };
      var code = info.code;
      var c = String.fromCharCode(code);
      info.name = SPECIAL[code] || c;
      info.char = c;
      return info;
    }

    function queue(cmd) {
      _cmdQueue.push(cmd);
      if(_suspended) {
        return;
      }
      call(_cmdQueue.shift());
    }

    function call(cmd) {
      console.log('calling: ' + cmd.name + ', previous: ' + _lastCmd);
      _lastCmd = cmd.name;
      cmd();
    }

    function cmdBackpace() {
      if(_cursor == 0) {
        return;
      }
      --_cursor;
      _text = _strUtil.remove(_text, _cursor, _cursor + 1);
      refresh();
    }

    function cmdComplete() {
      if(!_onCompletion) {
        return;
      }
      suspend(function(resumeCallback) {
        _onCompletion(self.getLine(), function(completion) {
          if(completion) {
            _text = _strUtil.insert(_text, _cursor, completion);
            updateCursor(_cursor + completion.length);
          }
          _completionActive = true;
          resumeCallback();
        });
     });
    }

    function cmdDone() {
      if(!_text) {
        return;
      }
      var text = _text;
      _history.accept(text);
      _text = '';
      _cursor = 0;
      if(!_onEnter) {
        return;
      }
      suspend(function(resumeCallback) {
        _onEnter(text, self.getLine(), resumeCallback);
      });
    }

    function suspend(asyncCall) {
      _suspended = true;
      asyncCall(resume);
    }

    function resume() {
      var cmd = _cmdQueue.shift();
      if(!cmd) {
        _suspended = false;
        return;
      }
      call(cmd);
      resume();
    }

    function cmdEnd() {
      updateCursor(_text.length);
    }

    function cmdHome() {
      updateCursor(0);
    }

    function cmdLeft() {
      if(_cursor == 0) {
        return;
      }
      updateCursor(_cursor - 1);
    }

    function cmdRight() {
      if(_cursor == _text.length) {
        return;
      }
      updateCursor(_cursor + 1);
    }

    function cmdHistoryPrev() {
      if(!_history.hasPrev()) {
        return;
      }
      getHistory(_history.prev);
    }

    function cmdHistoryNext() {
      if(!_history.hasNext()) {
        return;
      }
      getHistory(_history.next);
    }

    function cmdDeleteChar() {
      if(_cursor == _text.length) {
        return;
      }
      _text = _strUtil.remove(_text, _cursor, _cursor + 1);
      refresh();
    }

    function cmdKillToEOF() {
      _kill_buffer = _text.substr(_cursor);
      _text = _text.substr(0, _cursor);
      refresh();
    }

    function cmdYank() {
      _text = _strUtil.insert(_text, _cursor, _kill_buffer);
      updateCursor(_cursor + _kill_buffer.length);
    }

    function cmdRefresh() {
      refresh();
    }

    function cmdReverseSearch() {

    }

    function cmdBackwardWord() {

    }

    function cmdForwardWord() {

    }

    function updateCursor(position) {
      _cursor = position;
      refresh();
    }

    function addText(c) {
      _text = _strUtil.insert(_text, _cursor, c);
      ++_cursor;
      refresh();
    }

    function refresh() {
      if(_completionActive) {
        _completionActive = false;
        if(_onCompletion) {
          _onCompletion();
        }
      }
      if(_onChange) {
        _onChange(self.getLine());
      }
    }

    function getHistory(historyCall) {
      _history.update(_text);
      _text = historyCall();
      updateCursor(_text.length);
    }

    // set up key capture
    document.onkeydown = function(e) {
      e = e || window.event
      if(!_active) {
        return true;
      }
      //console.log("keydown - code: " + e.keyCode);
      var handled = true;
      switch(e.keyCode) {
        case 8:  // Backspace
          queue(cmdBackpace);
          break;
        case 9:  // Tab
          queue(cmdComplete);
          break;
        case 13: // Enter
          queue(cmdDone);
          break;
        case 35: // End
          queue(cmdEnd);
          break;
        case 36: // Home
          queue(cmdHome);
          break;
        case 37: // Left
          queue(cmdLeft);
          break;
        case 38: // Up
          queue(cmdHistoryPrev);
          break;
        case 39: // Right
          queue(cmdRight);
          break;
        case 40: // Down
          queue(cmdHistoryNext);
          break;
        case 46: // Delete
          queue(cmdDeleteChar);
          break;

        // these we catch and have no commands for
        case 10: // Pause
        case 19: // Caps Lock
        case 27: // Esc
        case 33: // Page Up
        case 34: // Page Down
        case 45: // Insert
          break;

        // all others we don't handle at this level
        default:
          handled = false;
          break;
      }
      if(!handled) {

        // intercept ctrl- and alt- sequences
        if(e.ctrlKey && !e.shiftKey && !e.altKey) {
          switch(e.keyCode) {
            case 65: // A
              queue(cmdHome);
              handled = true;
              break;
            case 69: // E
              queue(cmdEnd);
              handled = true;
              break;
            case 66: // B
              queue(cmdLeft);
              handled = true;
              break;
            case 70: // F
              queue(cmdRight);
              handled = true;
              break;
            case 80: // P
              queue(cmdHistoryPrev);
              handled = true;
              break;
            case 78: // N
              queue(cmdHistoryNext);
              handled = true;
              break;
            case 75: // K
              queue(cmdKillToEOF);
              handled = true;
              break;
            case 89: // Y
              queue(cmdYank);
              handled = true;
              break;
            case 68: // D
              queue(cmdDeleteChar);
              handled = true;
              break;
            case 76: // L
              queue(cmdRefresh);
              handled = true;
              break;
            case 82: // R
              queue(cmdReverseSearch);
              handled = true;
              break;
          }
        } else if(e.altKey && !e.ctrlKey && !e.shiftKey) {
          switch(e.keyCode) {
            case 66: // B
              queue(cmdBackwardWord);
              handled = true;
              break;
            case 70: // F
              queue(cmdForwardWord);
              handled = true;
              break;
          }
        }
      }
      if(!handled) {
        return true;
      }
      var info = getKeyInfo(e);
      if(_onKeydown) {
        _onKeydown({
          code: e.keyCode,
          shift: e.shiftKey,
          control: e.controlKey,
          alt: e.altKey,
          name: SPECIAL[e.keyCode],
          isChar: false
        });
      }
      e.preventDefault();
      return false;
    };
    document.onkeypress = function(e) {
      if(!_active) {
        return true;
      }
      //console.log("keypress - code: " + e.keyCode + ", char: " + String.fromCharCode(e.keyCode) + ", ctrl: " + e.ctrlKey);
      var key = getKeyInfo(e);
      queue(function cmdKeyPress() {
        addText(key.char);
        if(_onKeydown) {
          _onKeydown(key);
        }
      });
      e.preventDefault();
      return false;
    };

    return self;
  };

  ReadLine.StrUtil = {
    remove: function(text, from, to) {
      if(text.length <= 1 || text.length <= to - from) {
        return '';
      }
      if(from == 0) {

        // delete leading characters
        return text.substr(to);
      }
      var left = text.substr(0, from);
      var right = text.substr(to);
      return left + right;
    },
    insert: function(text, idx, ins) {
      if(idx == 0) {
        return ins + text;
      }
      if(idx >= text.length) {
        return text + ins;
      }
      var left = text.substr(0, idx);
      var right = text.substr(idx);
      return left + ins + right;
    }
  };

  ReadLine.History = function() {

    var _history = [''];
    var _cursor = 0;

    return {
      update: function(text) {
        _history[_cursor] = text;
      },
      accept: function(text) {
        if(_cursor == _history.length - 1) {
          _history[_cursor] = text;
        } else {
          _history.push(text);
        }
        _history.push('');
        _cursor = _history.length - 1;
      },
      hasNext: function() {
        return _cursor < (_history.length - 1);
      },
      hasPrev: function() {
        return _cursor > 0;
      },
      prev: function() {
        --_cursor;
        return _history[_cursor];
      },
      next: function() {
        ++_cursor;
        return _history[_cursor];
      }
    };
  };
})();


