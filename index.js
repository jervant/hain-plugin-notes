(function () {
    'use strict';

    const _ = require('lodash');
    const storage = require('jsonfile');

    const options = require('./package.json').hain;

    module.exports = (context) => {
        const logger = context.logger;
        const toast = context.toast;
        const app = context.app;

        const file = 'notes.json';
        var notes = [];
        var output = [];

        function startup() {
            notes = storage.readFileSync(getFilePath());
        }

        function getFilePath() {
            return __dirname + '/' + file;
        }

        function randString(x){
            var s = "";
            while(s.length<x&&x>0){
                var r = Math.random();
                s+= (r<0.1?Math.floor(r*100):String.fromCharCode(Math.floor(r*26) + (r>0.5?97:65)));
            }
            return s;
        }

        function prepareOutput(data, payload = 'show', desc = 'Note') {
            output = [];
            _.forEach(data, function (note, index) {
                logger.log(index);

                var id = (payload === 'show') ? note.text : note.id;

                output.push(
                    {
                        id: id,
                        payload: payload,
                        title: note.text,
                        desc: desc
                    }
                );
            });
        }

        function findNote(string) {
            var results = {
                found : [],
                new : false
            };

            results.found =  _.filter(notes, function(note) {
                return note.text.indexOf(string) >= 0;
            });

            if(!_.find(notes, function(note) { return note.text === string })){
                results.new = string;
            }

            return results;
        }

        function createNote(note) {
            notes.unshift({
                id : randString(32),
                text : note,
            });

            storage.writeFile(getFilePath(), notes, {}, function (err) {
                if (err) {
                    logger.log(err);
                    toast.enqueue('Error saving note!', 5000);
                } else {
                    app.setInput(options.prefix);
                    toast.enqueue('Note saved!', 2500);
                }
            })
        }

        function deleteNote(id) {
            _.remove(notes, function(note) {
                return note.id === id;
            });

            storage.writeFile(getFilePath(), notes, {}, function (err) {
                if (err) {
                    logger.log(err);
                    toast.enqueue('Error deleting note!', 5000);
                } else {
                    app.setInput(options.prefix);
                    toast.enqueue('Note deleted!', 2500);
                }
            })
        }

        function search(query, res) {

            const query_trim = query.trim();

            if (query_trim.length === 0) {
                if(notes.length){
                    prepareOutput(notes);
                }else{
                    prepareOutput([{
                        id : null,
                        text : 'You don\'t have any notes. To create a note just type something end press Enter.'
                    }], 'info', 'Info');
                }

                return res.add(output);
            }

            var result = findNote(query_trim);

            if(result.found.length || result.new.length){
                output = [];

                if(result.found.length){
                    prepareOutput(result.found, 'delete', 'Delete');
                }

                if(result.new){
                    output.unshift(
                        {
                            id: result.new,
                            payload: 'create',
                            title: result.new,
                            desc: 'Create'
                        }
                    );
                }
            }else{
                output = [
                    {
                        id: query_trim,
                        payload: 'create',
                        title: query_trim,
                        desc: 'Create'
                    }
                ];
            }

            res.add(output);
        }

        function execute(id, payload) {

            switch (payload){
                case 'create':
                    createNote(id);
                    break;
                case 'delete':
                    deleteNote(id);
                    break;
                case 'info':
                    return;
                    break;
                default:
                    app.setInput(options.prefix + id);
            }

            return;
        }

        return {startup, search, execute};
    };
}());