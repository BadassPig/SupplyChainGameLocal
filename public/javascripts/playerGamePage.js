var gameData = {name: '',	// player name
				openInput: -1, // index of input that should be editable
				data: [],
			};

// DOM Ready =============================================================
$(document).ready(function() {
	var urlPath = window.location.pathname; //"/playerGamePage/testPlayer1"
	gameData.name = urlPath.replace('/playerGamePage/', '');
    // At the begining client should fetch game data from server.
    populateGameTable();
    registerActions();
});

function registerActions() {
	//$('#btnSendOrder').prop("disabled", true);

	//$('#btnSendOrder').on('click', sendOrder);
	$('form').submit(sendOrder);

	$("form").bind("keypress", function (e) {
	    if (e.keyCode == 13) {
	        //$("#btnSearch").attr('value');
	        //add more buttons here
	        return false;
	    }
	});

  $('#logout').on('click', logoutUser);

  // Sever Sent Event
	var source = new EventSource('/game/ssePlayerGameData');
	source.addEventListener('message', function(e) {
    var data = JSON.parse(e.data);
    // console.log('Received SSE update:');
    // console.log(data);
    gameData.data = data[gameData.name];
    // Should not re-request here!
    populateGameTable();
  }, false);
	source.addEventListener('open', function(e) {
    console.log('EventSource connected');
  }, false);

  source.addEventListener('error', function(e) {
    if (e.target.readyState == EventSource.CLOSED) {
      console.log('E`gventSource disconnected.');
    }
    else if (e.target.readyState == EventSource.CONNECTING) {
      console.log('Connecting to EventSource.');
    }
  }, false);
};

function populateGameTable() {
	console.debug('Requesting playerTable');
    $.getJSON( '/game/getPlayerTable/' + gameData.name, function( data ) {
      var gameTableContent;
      // console.log('Received response from server:');
      // console.log(data);
      gameData.data = data;
      // Always get last element of data.
      data.forEach(function(element, index) {
      	gameTableContent += '<tr>';
        gameTableContent += '<td>' + index + '</td>';	// Round
        //gameTableContent += '<td>' + gameData.name + '</td>';	// Player
        gameTableContent += '<td>' + element.supply + '</td>';	//supply
        gameTableContent += '<td>' + element.cost + '</td>';	// cost
        gameTableContent += '<td><input id="input' + index + '" type="number" min="0" form="formGameTable" value="' + (element.order ? element.order : '') + '" disabled required></td>';	// order	        
        gameData.openInput = !element.order ? index : gameData.openInput;
        gameTableContent += '</tr>';
      });
      // Append vs replace everything in table
      //$('#gameTableBlock table tbody').append(gameTableContent);
      $('#gameTableBlock table tbody').html(gameTableContent);
      if (gameData.openInput !== -1) {
      	$('input[id="input' + gameData.openInput + '"]').prop('disabled', false);
      	$('#formGameTable #submitOrd').prop('disabled', false);
      } else
      	$('#formGameTable #submitOrd').prop('disabled', true);
    });
};

function sendOrder(event){
	event.preventDefault();
	//console.log('Submit order clicked!');
	var orderData = {newOrder : 0};
	orderData.newOrder = $('input[id="input' + gameData.openInput + '"]').val();

  $.ajax({
    type : 'POST',
    data : orderData,
    url : '/game/submitOrder/' + gameData.name,
    dataType : 'JSON'
    }).done(function(res) {
      // For some reason this is not called.
      //console.log('Submit successful!.');
      $('input[id="input' + gameData.openInput + '"]').prop('disabled', true);
      $('#formGameTable #submitOrd').prop('disabled', true);
    }).fail(function(res) {
      console.log('Submit order failed?');
    });
};

function logoutUser(event) {
  event.preventDefault();
  console.debug('Logging out user ' + gameData.name);
  $.ajax(
  {
    url: '/users/logout/'
  }).done(function( response ) {
    window.location.reload();  
  });
};