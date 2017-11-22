define([
    'widgets/EasyDAG/Connection'
], function(
    BaseConnection
) {
    var Connection = function() {
        BaseConnection.apply(this, arguments);
    };

    _.extend(Connection.prototype, BaseConnection.prototype);

    Connection.prototype.onClick = function() {
    };

    return Connection;
});
