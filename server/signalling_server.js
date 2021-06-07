const express = require('express')
const app = express()
// const server = require('http').Server(app)
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
    cors: {
        origin: "http://192.168.1.36:4200",
        methods: ["GET", "POST"],
        transports: ['websocket', 'polling'],
        Credentials: true,
        connectTimeout: 60000,
        pingTimeout: 10000
    }
    // allowEIO3: true
}).listen(server);


var _userConnections = [];
// app.get('/:room',(req,res)=>{
//     res.render('video-conference',{roomId: req.params.room})
// })

io.on('connection', (socket) => {
    console.log(socket.connected);

    socket.on('userconnect', (data) => {
        console.log('userconnect', data.displayName, data.meetingid);

        // if(_userConnections != null){
        //     var other_users = _userConnections.filter(p => p.meeting_id == data.meetingid);
        //     console.log("Other users are: ", other_users);
        // }
        
        if(!_userConnections.find(p => p.connectionId == socket.id)){
            _userConnections.push({
                connectionId: socket.id,
                user_id: data.displayName,
                meeting_id: data.meetingid
            });
        }

        _userConnections.forEach(v => {
            socket.to(v.connectionId).emit('informAboutNewConnection', { other_user_id: data.displayName, connId: socket.id });
        });

        socket.emit('userconnected', _userConnections);
        //return other_users;
    });//end of userconnect

    socket.on('join-room', (roomId, userId) => {
        console.log("Joined Room", roomId, userId);
        socket.join(userId);
        _userConnections.push(userId);
        socket.broadcast.to(roomId).emit('user-connected', userId);

        socket.on('disconnected', (reason, userId) => {
            console.log(reason);
            //remove user from User list
            // _userConnections.delete(userId);
            console.log("After disconnection: ", _userConnections);
            socket.broadcast.to(roomId).emit('user-disconnected', userId);
        });

    });

    // handle the event sent with socket.send()
    // socket.on("message", (data) => {
    //     io.emit("message", data);
    //     console.log(" OUTSIDE ", data.type);
    // });

    socket.on('exchangeSDP', (data) => {

        socket.to(data.to_connid).emit('exchangeSDP', { message: data.message, from_connid: socket.id });

    });//end of exchangeSDP

    socket.on('reset', (data) => {
        var userObj = _userConnections.find(p => p.connectionId == socket.id);
        if (userObj) {
            var meetingid = userObj.meeting_id;
            var list = _userConnections.filter(p => p.meeting_id == meetingid);
            _userConnections = _userConnections.filter(p => p.meeting_id != meetingid);

            list.forEach(v => {
                socket.to(v.connectionId).emit('reset');
            });

            socket.emit('reset');
        }

    });//end of reset

    socket.on('message', (msg) => {
        console.log(msg);
        socket.emit("message", msg);
        
        var userObj = _userConnections.find(p => p.connectionId == socket.id);
        if (userObj) {
            var meetingid = userObj.meeting_id;
        //     // var from = userObj.user_id;

            var list = _userConnections.filter(p => p.connectionId == userObj.connectionId);
            console.log("list to send out messages: ", list)

            list.forEach(v => {
                console.log("Sending message to list ");
                socket.to(v.connectionId).emit('message', msg);
            });

            // socket.emit('message', msg);
        }
    });//end of reset

    socket.on('disconnect', function () {
        console.log('Got disconnect!');
        console.log("After got disconnected 1: ", _userConnections);
        var userObj = _userConnections.find(p => p.connectionId == socket.id);
        if (userObj) {
            var meetingid = userObj.meeting_id;

            _userConnections = _userConnections.filter(p => p.connectionId != socket.id);
            var list = _userConnections.filter(p => p.meeting_id == meetingid);
            console.log("After got disconnected 2: ", _userConnections);
            list.forEach(v => {
                socket.to(v.connectionId).emit('informAboutConnectionEnd', socket.id);
            });
        }
    });
});

server.listen(3000, () => {
    console.log("Socket.io server is listening on port 3000");
});

