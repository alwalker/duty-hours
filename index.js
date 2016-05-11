var express = require('express');
var pg = require('pg');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.get('/', function(request, response) {
	response.send('Woooo!');
});

app.get('/api/users', function (request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		if (err)
			{ console.error(err); response.send("Error " + err); }
		client.query('SELECT * FROM users', function(err, result) {
			done();
			if (err)
				{ console.error(err); response.send("Error " + err); }
			else
				{ response.send({results: result.rows}); }
		});
	});
});

app.put('/api/:user/shift', function(request, response) {
	findUser(
		request.params.user,
		function() {response.send("Couldn't find user!");}, 
		function() {response.send("Found user!")})
});

app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});





function findUser(user, not_found_func, found_func) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		if (err) { 
			console.error(err); 
			not_found_func();
			return;
		}
		client.query('SELECT * FROM users', function(err, result) {
			done();
			if (err) { 
				console.error(err); 
				not_found_func();
				return;
			}
			else {
				var found = false;
				for(var row in result.rows) {
					if(result.rows[row]['email'] === user) {
						found = true;
						break;
					}
				}

				if(found) {
					console.log('found them!');
					found_func();
				}
				else {
					console.log('not found!');
					not_found_func();
				}
			}
		});
	});
}
