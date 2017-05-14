var gameData = {
  name: '',  // player name
  openInput: -1, // index of input that should be editable
  data: [],
};

var pageData = {
  playerID : '',
  showPrevGame : false,
  gameEnded : false
}

// DOM Ready =============================================================
$(document).ready(function() {
  var urlPath = window.location.pathname; //"/playerGamePage/testPlayer1"
  pageData.playerID = urlPath.replace('/playerGamePage/', '');
  // At the begining client should fetch game data from server.
  $('#gameTable th:nth-child(2)').hide();  // hide player column
  $('#prevGameListTable').hide();
  populateGameTable();
  registerActions();
});

function registerActions() {
  $('#btnSubmitOrd').prop("disabled", true);
  $('#btnSubmitOrd').on('click', sendOrder);
  //$('form').submit(sendOrder);
  $('#btnShowPrev').on('click', showPrevGameList);

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
    gameData.data = data[pageData.playerID];
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
    $.getJSON( '/game/getPlayerTable/' + pageData.playerID, function( data ) {
      var gameTableContent;
      // console.log('Received response from server:');
      // console.log(data);
      gameData.data = data;
      gameData.openInput = -1;
      populateGameTableWithData(data);
    }).fail(function() {
      $('#btnSubmitOrd').prop('disabled', true);
    });
};

function populateGameTableWithData(gameDataArray) {
  if (Array.isArray(gameDataArray)) {
    var gameTableContent = '';
    gameDataArray.forEach(function(element, index) {
      gameTableContent += '<tr>';
      gameTableContent += '<td>' + index + '</td>';  // Round
      gameTableContent += '<td>' + element.demand + '</td>';  // Demand
      gameTableContent += '<td><input id="input' + index + '" type="number" min="0" form="formGameTable" value="' + (element.order ? element.order : '') + '" disabled required></td>';  // order          
      gameData.openInput = !element.order ? index : gameData.openInput;
      gameTableContent += '<td>' + element.ration + '</td>';  // Ration
      gameTableContent += '<td>' + element.sales + '</td>';  // Sales
      gameTableContent += '<td>' + element.lostSales + '</td>';  // lost sales
      gameTableContent += '<td>' + element.surplusInv + '</td>';  // Surplus Inventory
      gameTableContent += '<td>' + element.profit + '</td>';  // Profit
      gameTableContent += '<td>' + element.cumuProfit + '</td>';  // Cumulative Profit
      gameTableContent += '</tr>';
    });
    // Append vs replace everything in table
    //$('#gameTableBlock table tbody').append(gameTableContent);
    $('#gameTableBlock table tbody').html(gameTableContent);
    if (gameData.openInput !== -1) {
      $('input[id="input' + gameData.openInput + '"]').prop('disabled', false);
      $('#btnSubmitOrd').prop('disabled', false);
    } else
      $('#btnSubmitOrd').prop('disabled', true);
  }
};

function sendOrder(event){
  event.preventDefault();
  //console.log('Submit order clicked!');
  var orderData = {newOrder : 0};
  orderData.newOrder = $('input[id="input' + gameData.openInput + '"]').val();
  if (!orderData.newOrder || orderData.newOrder < 0) {
    $('#pErr').text('Order needs to be set and greater than 0.0');
    return ;
  } else
    $('#pErr').text('');

  $.ajax({
    type : 'POST',
    data : orderData,
    url : '/game/submitOrder/' + pageData.playerID,
    dataType : 'JSON'
    }).done(function(res) {
      // For some reason this is not called.
      //console.log('Submit successful!.');
      $('input[id="input' + gameData.openInput + '"]').prop('disabled', true);
      $('#btnSubmitOrd').prop('disabled', true);
    }).fail(function(res) {
      console.log('Submit order failed?');
    });
};

function logoutUser(event) {
  event.preventDefault();
  console.debug('Logging out user ' + pageData.playerID);
  $.ajax(
  {
    type  : 'GET',
    url   : '/users/logout/' + pageData.playerID
  }).done(function( response ) {
    console.log('Log out action successful!');
    // There should be better way of doing this. For example just echo response on page.
    window.location.reload();
  }).fail(function(res) {
    console.log('Log out action failed!');
  });
};

function showPrevGameList(event) {
  event.preventDefault();
  if (pageData.showPrevGame) {
    $('#btnShowPrev').text("Show Game List");
    $('#prevGameListTable').hide();
  } else {
    $('#btnShowPrev').text("Hide Game List");
    $('#prevGameListTable').show();

    // Make JSON request to get live data every time the button is toggled.
    // Still trying to figure out if instructorID should be URL parameter or in JSON
    $.getJSON( '/game/getAllOldGame', {player: pageData.playerID}, function( data ) {
      // Data will be an array of historical game info
      // Example: [{"Time":1489115942142,"NumPlayer":"2","NumPeriod":"2"},{"Time":1489118499196,"NumPlayer":"2","NumPeriod":"3"}]
      prevGameList = data;
      var prevGameTable;
      data.map(obj=>{
        prevGameTable += '<tr>';
        prevGameTable += '<td>' + (new Date(obj.Time)).toLocaleString() + '</td>';
        prevGameTable += '<td>' + obj.NumPlayer + '</td>';
        prevGameTable += '<td>' + obj.NumPeriod + '</td>';
        // You can do button drop down here as well.
        prevGameTable += '<td><select>' + '<option value="select">Select</option>' + '<option value="view">View</option>' + '</select></td>';
        prevGameTable += '</tr>';
      });
      $('#prevGameListTable tbody').html(prevGameTable);
      // Because prev game table is not populated till the actual show action takes place, select event can only be binded now.
      $('#prevGameListTable tbody select').on('change', function() {
        var sel = $(this).val();
        if (sel == 'select')
          return ;
        var row = $(this).parent().parent().index();  // First parent() gives you <td>, second parent() gives you <tr>
        var column = $(this).parent().index();
        var selectedGameId = prevGameList[row].Time;
        // Whenever user makes a selection, reset all other selections to 'select' (because we bind on 'change')
        $('#prevGameListTable select').val('select');
        $('#prevGameListTable tbody tr:eq(' + row + ') select').val(sel);
        if (sel == 'view') {
          $.getJSON('/game/getOldGameById', {gameID : selectedGameId, player : pageData.playerID}, function(data) {
            //console.log(data);
            $('#btnNextRnd').prop("disabled", true);
            populateGameTableWithData(data);
          });
        }
        // else if (sel == 'delete') {
        //   var r = confirm('Do you want to remove this game? Removed game can\'t be recovered.');
        //   if (r) {
        //     $.ajax({
        //       type: 'DELETE',
        //       //data: {gameID : selectedGameId, instructor : pageData.instructorID},
        //       url: '/game/deleteGame/' + pageData.instructorID + '/' + selectedGameId
        //       //dataType: 'JSON'
        //     }).done( function (response) {
        //       console.log('Delete ' + selectedGameId + ' successful.');
        //       prevGameList.splice(row);
        //       // Repoulate game list
        //       populatePrevGameList(prevGameList);
        //     }).fail( function (jqXHR, textStatus) {
        //       console.log('Deleting game row ' + (row + 1) + ' failed: ' + textStatus);
        //     });
        //   } // if (r)
        // }
      });
    });
  }
  pageData.showPrevGame = !pageData.showPrevGame;
}