'use strict';

var loopback = require('loopback');
var boot = require('loopback-boot');

var app = (module.exports = loopback());

app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    // app.start();
    app.io = require('socket.io')(app.start());
  let io = app.io;
  require('socketio-auth')(app.io, {
    authenticate: function(socket, value, callback) {
      // get credentials sent by the client
      callback(null, true);

      let promiseToken = new Promise((resolve, reject) => {
        var AccessToken = app.models.accessToken;
        AccessToken.find(
          {
            where: {
              userId: value.userId,
              id: value.id,
            },
          },
          function(err, tokenDetail) {
            if (err) reject(err);
            resolve(tokenDetail);
          }
        );
      });

      promiseToken
        .then(value => {
          if (value.length > 0) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        })
        .catch(reason => {
          console.log(reason);
        });

      // var token = AccessToken.find(
      //   {
      //     where: {
      //       userId: value.userId,
      //       id: value.id,
      //     },
      //   },
      //   function(err, tokenDetail) {
      //     if (err) throw err;
      //     console.log('tokenDetail', tokenDetail);
      //     console.log('err', err);
      //     // callback(null, true);
      //     // if (tokenDetail.length > 0) {
      //     //   callback(null, true);
      //     // } else {
      //     //   callback(null, false);
      //     // }
      //   }
      // ); // find function..
    }, // authenticate function..
  });

  app.io.on('connection', function(socket) {
    console.log('a user connected');
    socket.on('disconnect', reason => {
      // socket.disconnect(true);
      // console.info('disconnected user (id=' + socket.id + ').');
      console.log('user disconnected', reason);
    });

    // let promiseLocation = new Promise((resolve, reject) => {
    //   var driver = app.models.driver;
    //   socket.on('location-client', function(data) {
    //     driver.updateAll({region: data}, function(err, data) {
    //       if (err) reject(err);
    //       resolve(data);
    //     });
    //   });
    // });
    // promiseLocation.then().catch(reason => {
    //   console.log(reason);
    // });

    // ==========================================
    // ================ Get list driver ==================
    // ==========================================

    let promiseDriver = new Promise((resolve, reject) => {
      var driver = app.models.driver;
      driver.find(
        {
          where: {
            status: 'available',
          },
        },
        function(err, data) {
          if (err) reject(err);
          resolve(data);
        }
      );
    });
    promiseDriver
      .then(value => {
        io.emit('get-driver', value);
      })
      .catch(reason => {
        console.log(reason);
      });
    // ==========================================
    // ================Get list job emit to client==================
    // ==========================================

    let promise = new Promise((resolve, reject) => {
      var job = app.models.job;
      job.find(
        {
          include: ['member', 'driver'],
          where: {
            status: 'available',
          },
        },
        function(err, data) {
          if (err) reject(err);
          resolve(data);
        }
      );
    });
    promise
      .then(value => {
        io.emit('get-job', value);
      })
      .catch(reason => {
        console.log(reason);
      });
    // =================================================
    // ============ Update region position==============
    // =================================================
    socket.on('location-client', function(data) {
      let promiseLocation = new Promise((resolve, reject) => {
        var driver = app.models.driver;
        console.log(data);
        driver.updateAll(
          {
            where: {
              $oid: data.userId,
            },
          },
          {region: data.region},
          function(err, data) {
            if (err) reject(err);
            resolve(data);
          }
        );
      });

      promiseLocation
        .then(value => {
          let promiseDriver1 = new Promise((resolve, reject) => {
            var driver = app.models.driver;
            driver.find(
              {
                where: {
                  status: 'available',
                },
              },
              function(err, data) {
                if (err) reject(err);
                resolve(data);
              }
            );
          });
          promiseDriver1
            .then(val => {
              io.emit('get-driver', val);
            })
            .catch(reason => {
              console.log(reason);
            });
        })
        .catch(reason => {
          console.log(reason);
        });
    });
    // ==========================================
    // ============== Create job ============================
    // ==========================================
    io.on('create-job', function(data) {
      console.log(data);
    });
  });
});
