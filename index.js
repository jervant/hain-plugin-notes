(function () {
    'use strict';

    const _ = require('lodash');
    const fs = require('fs');
    const uuid = require('uuid');

    const low = require('lowdb');
    const storage = require('lowdb/file-sync');
    const db = low(__dirname + '/db.json', {storage});

    const options = require('./package.json').hain;

    module.exports = (context) => {
        const logger = context.logger;
        const toast = context.toast;
        const app = context.app;

        var notes = [];
        var output = [];

        function startup() {
            db._.mixin({
                last: function(array) {
                    return _.last(array);
                },
                like: function(array, value, attribute) {
                    return _.filter(array, function (item) {

                        if(item[attribute]){
                            return item[attribute].indexOf(value) >= 0;
                        }

                        return false;
                    })
                }
            });

            fetchData();
        }

        function migrate(version) {

            var migration = db('migrations').last();

            if (!migration || migration.version !== version) {
                var legacyStore = __dirname + '/notes.json';

                fs.stat(legacyStore, function (err, stat) {
                    if (err === null) {

                        var legacyNotes = require('./notes.json');
                        _.each(legacyNotes, function (note) {
                            createNote(note.text);
                        });

                        db('migrations').push({ version : version});

                        fs.unlink(legacyStore, (err) => {
                            if (err) throw err;
                        });

                    } else if (err.code == 'ENOENT') {

                    } else {
                        logger.log(err);
                    }
                });
            }
        }

        function fetchData() {
            try {
                notes = db('notes').value();

                migrate('0.0.1');

            } catch (err) {
                logger.log(err);
            }
        }

        function prepareOutput(data, payload = 'show', desc = 'Note') {
            output = [];
            _.forEach(data, function (note, index) {

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
                found: [],
                new: false
            };

            results.found = db('notes').like(string, 'text');

            if (!db('notes').find({text : string})) {
                results.new = string;
            }

            return results;
        }

        function createNote(note) {
            try {
                db('notes').push({ id : uuid(), text: note })
                app.setInput(options.prefix);
                toast.enqueue('Note saved!', 2500);
            } catch (err) {
                logger.log(err);
                toast.enqueue('Error saving note!', 5000);
            }
        }

        function deleteNote(id) {

            try {
                db('notes').remove({ id: id })
                app.setInput(options.prefix);
                toast.enqueue('Note deleted!', 2500);
            } catch (err) {
                logger.log(err);
                toast.enqueue('Error deleting note!', 5000);
            }
        }

        function search(query, res) {

            const query_trim = query.trim();

            if (query_trim.length === 0) {
                if (notes.length) {
                    prepareOutput(notes);
                } else {
                    prepareOutput([{
                        id: null,
                        text: 'You don\'t have any notes. To create a note just type something end press Enter.'
                    }], 'info', 'Info');
                }

                return res.add(output);
            }

            var result = findNote(query_trim);

            if (result.found.length || result.new.length) {
                output = [];

                if (result.found.length) {
                    prepareOutput(result.found, 'delete', 'Delete');
                }

                if (result.new) {
                    output.unshift(
                        {
                            id: result.new,
                            payload: 'create',
                            title: result.new,
                            desc: 'Create'
                        }
                    );
                }
            } else {
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
            switch (payload) {
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