var gameData = {name: '',	// player name
				openInput: -1, // index of input that should be editable
				data: [],
			};

// DOM Ready =============================================================
$(document).ready(function() {

	// TODO name should be passed in.
	gameData.name = 'testPlayer1';
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
};

function populateGameTable() {
	console.debug('Requesting playerTable');
    $.getJSON( '/game/getPlayerTable/' + gameData.name, function( data ) {
    	var gameTableContent;
    	//console.log('Recived respons from server:' + data);
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
        $('#gameTableBlock table tbody').append(gameTableContent);
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
	console.debug(orderData);
	$.ajax({
            type: 'POST',
            data: orderData,
            url: '/game/submitOrder/' + gameData.name,
            dataType: 'JSON'
        }).done(function( response ) {
        });
};