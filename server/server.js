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
  // require('socketio-auth')(app.io, {
  //   authenticate: function(socket, value, callback) {
  //     // get credentials sent by the client
  //     // callback(null, true);

  //     let promiseToken = new Promise((resolve, reject) => {
  //       var AccessToken = app.models.accessToken;
  //       AccessToken.find(
  //         {
  //           where: {
  //             userId: value.userId,
  //             id: value.id,
  //           },
  //         },
  //         function(err, tokenDetail) {
  //           if (err) reject(err);
  //           resolve(tokenDetail);
  //         }
  //       );
  //     });

  //     promiseToken
  //       .then(value => {
  //         console.log(value);
  //         if (value.length > 0) {
  //           callback(null, true);
  //         } else {
  //           callback(null, false);
  //         }
  //       })
  //       .catch(reason => {
  //         console.log(reason);
  //       });
  //   },
  // });

  app.io.on('connection', function(socket) {
    console.log('a user connected');
    socket.on('disconnect', reason => {
      // socket.disconnect(true);
      // console.info('disconnected user (id=' + socket.id + ').');
      console.log('user disconnected', reason);
    });

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

    // ==========================================
    // ================Get list job emit to member==================
    // ==========================================

    let promiseListJobToMember = new Promise((resolve, reject) => {
      var job = app.models.job;
      job.find(
        {
          include: ['member', 'driver'],
          where: {
            status: 'doing',
          },
        },
        function(err, data) {
          if (err) reject(err);
          resolve(data);
        }
      );
    });
    promiseListJobToMember
      .then(value => {
        io.emit('get-job-member', value);
      })
      .catch(reason => {
        console.log(reason);
      });
    // ==========================================
    // ================Get list job doing==================
    // ==========================================
    socket.on('emit-get-job-doing', function(data) {
      let promiseJobDoing = new Promise((resolve, reject) => {
        var job = app.models.job;
        job.find(
          {
            include: ['member', 'driver'],
            where: {
              driverId: data,
              status: 'doing',
            },
          },
          function(err, data) {
            if (err) reject(err);
            resolve(data);
          }
        );
      });
      promiseJobDoing
        .then(value => {
          io.emit('get-job-doing', value);
          if (value.length === 0) {
            promise
              .then(value => {
                io.emit('get-job', value);
              })
              .catch(reason => {
                console.log(reason);
              });
          }
        })
        .catch(reason => {
          console.log(reason);
        });
    });
    // =================================================
    // ============ Update region position==============
    // =================================================
    socket.on('location-client', function(data) {
      let promiseLocation = new Promise((resolve, reject) => {
        var driver = app.models.driver;
        driver.updateAll(
          {
            driverId: data.userId,
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
    socket.on('create-job', function(data) {
      let promiseCreateJob = new Promise((resolve, reject) => {
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
      promiseCreateJob
        .then(value => {
          io.emit('get-job', value);
          io.emit('get-job-member', value);
        })
        .catch(reason => {
          console.log(reason);
        });
    });
    // ==========================================
    // ============== Driver accept job ============================
    // ==========================================
    socket.on('driver-accept-job', function(data) {
      let promiseDriverAccept = new Promise((resolve, reject) => {
        var job = app.models.job;
        job.updateAll(
          {
            jobId: data.jobId,
          },
          {
            driverId: data.driverId,
            status: 'doing',
          },
          function(err1, data1) {
            if (err1) reject(err1);
            job.find(
              {
                include: ['member', 'driver'],
                where: {
                  driverId: data.driverId,
                  status: 'doing',
                },
              },
              function(err2, data2) {
                if (err) reject(err);
                resolve(data2);
              }
            );
          }
        );
      });

      promiseDriverAccept
        .then(value => {
          io.emit('get-job', value);
          io.emit('get-job-member', value);
        })
        .catch(reason => {
          console.log(reason);
        });
    });
    // ==========================================
    // ============== Member done job ============================
    // ==========================================
    socket.on('member-done-job', function(data) {
      let promiseMemberDone = new Promise((resolve, reject) => {
        var job = app.models.job;
        job.updateAll(
          {
            jobId: data.jobId,
          },
          {
            status: 'done',
          },
          function(err1, data1) {
            if (err1) reject(err1);
            resolve(data1);
          }
        );
      });

      promiseMemberDone
        .then(value => {
          promise
            .then(value => {
              io.emit('get-job', value);
            })
            .catch(reason => {
              console.log(reason);
            });
        })
        .catch(reason => {
          console.log(reason);
        });
    });
  });
});
