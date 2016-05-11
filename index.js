var express = require('express');
var pg = require('pg');
var bodyParser = require('body-parser');
var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.json());

app.get('/', function(request, response) {
	response.send('Woooo!');
});

app.put('/api/:user/shift', function(request, response) {
	findUser(
		request.params.user,
		function() {response.send("Couldn't find user!");}, 
		function(user) {
			pg.connect(process.env.DATABASE_URL, function(err, client, done) {
				if (err) { 
					console.error(err); response.send("Error " + err); 
				}
				client.query(
					'INSERT INTO shifts (user_id, start_dt, end_dt) VALUES($1,$2,$3)',
					[user['id'], request.body.start, request.body.end],
					function(err, result) {
						done();
						if (err) { 
							console.error(err); 
							response.send("Error adding shift to database"); 
						}
						else { 
							response.send('Ok!'); 
						}
					});
			});
		});
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
				for(var row in result.rows) {
					if(result.rows[row]['email'] === user) {
						console.log('found them!');
						found_func(result.rows[row]);
						return;
					}
				}
				console.log('not found!');
				not_found_func();
			}
		});
	});
}
