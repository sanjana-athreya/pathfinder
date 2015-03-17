/**
 * Created by sam on 13.03.2015.
 */
define(['jquery','jquery-ui'],function($) {
  'use strict';

  function getIncrementalJSON(url, data, onChunkDone) {
    var processed = 0;

    function sendChunk(path) {
      path = JSON.parse(path);
      onChunkDone(path);
    }

    function processPart(text) {
      var p = 0, act = 0, open = 0,
        l = text.length,
        c, start;
      if (text[act] === '[') { //skip initial [
        act = 1;
      }
      start = act;
      while (act < l) {
        c = text[act];
        if (c === '{') { //starting object
          open += 1;
        } else if (c === '}') { //closing object
          open -= 1;
          if (open === 0) { //found a full chunk
            sendChunk(text.substring(start, act + 1));
            start = act + 1;
            if (text[start] === ',') { //skip ,
              start += 1;
              act += 1;
            }
          }
        }
        act++;
      }
      return start; //everything before start was fully processed
    }

    return $.ajax({
      async: true,
      url: url,
      data: data,
      dataType: 'text',
      success: function (data) {
        processPart(data.substr(processed))
      },
      xhr: function () {
        // get the native XmlHttpRequest object
        var xhr = $.ajaxSettings.xhr();
        // set the onprogress event handler
        xhr.onprogress = function (evt) {
          processed += processPart(evt.currentTarget.responseText.substr(processed));
        };
        return xhr;
      }
    })
  }

  function searchPaths(source, target, k, onPathDone, nodeids) {
    return getIncrementalJSON('/api/pathway/path/' + source + '/' + target, {k: k || 10, nodeids: nodeids === true}, onPathDone);
  }

  function SearchPath(selector) {
    var that = this;
    this.search_cache = {};
    $(selector).load('search/search.html', function() {
      that.init();
    });
  }
  SearchPath.prototype.enableAutocomplete = function() {
    var that = this;
    $('#from_node, #to_node').autocomplete({
      minLength: 3,
      source: function( request, response ) {
        var term = request.term;
        if ( term in that.search_cache ) {
          response( that.search_cache[ term ] );
          return;
        }
        $.getJSON('/api/pathway/search', { q : term}).then(function(data) {
          that.search_cache[ term ] = data.results;
          response( data.results );
        });
      }
    });
  };
  SearchPath.prototype.init = function() {
    var that = this;
    this.enableAutocomplete();
    $('#search_form').on('submit', this.handleSubmit.bind($(this)));
  };
  SearchPath.prototype.handleSubmit = function() {
    var $this = this;
    var s = $('#from_node').val();
    var t = $('#to_node').val();
    var k = + $('#at_most_k').val();

    var $progress = $('#loadProgress').show()
      .attr("max", k)
      .attr("value", 0);

    $this.trigger('reset');
    var count = 0;
    var search = searchPaths(s, t, k, function (path) {
      console.log('got path', path);
      $this.trigger('addPath', path);
      count++;
      $progress.attr("value", count);
    }, true);

    search.success(function (paths) {
      paths = JSON.parse(paths);
      $progress.hide();
      console.log('got paths', paths);
    });
    search.error(function (error) {
      $progress.hide();
      $('<div title="Error">'+error+'</div>').dialog();
    });

    return false; //no real submit
  };

  return SearchPath;
});