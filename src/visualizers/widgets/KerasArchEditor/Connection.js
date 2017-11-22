/*globals define*/
define([
    'widgets/EasyDAG/Connection',
    'underscore'
], function(
    BaseConnection,
    _
) {
    var Connection = function() {
        BaseConnection.apply(this, arguments);
    };

    _.extend(Connection.prototype, BaseConnection.prototype);

    Connection.prototype.onClick = function() {
    };

    return Connection;
});
