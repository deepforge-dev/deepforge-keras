/*globals define, WebGMEGlobal, $*/
define([
    'widgets/EasyDAG/Buttons',
    'widgets/EasyDAG/Icons',
    'underscore',
    './lib/showdown.min'
], function(
    Buttons,
    Icons,
    _,
    showdown
) {

    var client = WebGMEGlobal.Client;
    var GoToBase = function(params) {
        // Check if it should be disabled
        var baseId = this._getBaseId(params.item),
            base = baseId && client.getNode(baseId);

        if (!params.disabled) {
            params.disabled = base ? base.isLibraryElement() : true;
        }
        Buttons.ButtonBase.call(this, params);
    };

    GoToBase.SIZE = 10;
    GoToBase.BORDER = 1;
    GoToBase.prototype.BTN_CLASS = 'go-to-base';
    GoToBase.prototype = new Buttons.ButtonBase();

    GoToBase.prototype._render = function() {
        var lineRadius = GoToBase.SIZE - GoToBase.BORDER,
            btnColor = '#90caf9';

        if (this.disabled) {
            btnColor = '#e0e0e0';
        }

        this.$el
            .append('circle')
            .attr('r', GoToBase.SIZE)
            .attr('fill', btnColor);

        // Show the 'code' icon
        Icons.addIcon('code', this.$el, {
            radius: lineRadius
        });
    };

    GoToBase.prototype._onClick = function(item) {
        var node = client.getNode(item.id),
            baseId = node.getBaseId();

        WebGMEGlobal.State.registerActiveObject(baseId);
    };

    GoToBase.prototype._getBaseId = function(item) {
        var n = client.getNode(item.id);
        return n && n.getBaseId();
    };

    Buttons.GoToBase = GoToBase;

    const mdConverter = new showdown.Converter();
    const ShowHelpDocs = function(params) {
        Buttons.ButtonBase.call(this, params);
    };

    ShowHelpDocs.SIZE = 10;
    ShowHelpDocs.BORDER = 1;
    ShowHelpDocs.prototype.BTN_CLASS = 'show-help-docs';
    ShowHelpDocs.prototype = new Buttons.ButtonBase();

    ShowHelpDocs.prototype._render = function() {
        var lineRadius = ShowHelpDocs.SIZE - ShowHelpDocs.BORDER,
            btnColor = '#e3f2fd';

        this.$el
            .append('circle')
            .attr('r', ShowHelpDocs.SIZE)
            .attr('fill', btnColor);

        // Show the 'code' icon
        Icons.addIcon('question-mark', this.$el, {
            radius: lineRadius
        });
    };

    ShowHelpDocs.convertDocsToHtml = function(docs) {
        // First preprocess the docstring to (nice) markdown
        docs = docs
            .replace(/^\s*/mg, '')  // default indentation creates code blocks
            .replace(/^([a-zA-Z_]+):/mg, (match, argName) => `- ${argName}:`);

        // Convert the arguments to a list
        return mdConverter.makeHtml(docs);
    };

    ShowHelpDocs.prototype._onClick = function(item) {
        const docs = ShowHelpDocs.convertDocsToHtml(item.desc.docs);

        // Remove old docs dialogs
        $('#show-docs').remove();

        const docsDialog = $(modalTpl({desc: item.desc, docs: docs}));
        docsDialog.modal('show');
    };

    const modalTpl = _.template(`
    <div class="show-docs modal fade" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title"><%= desc.name %> Documentation</h3>
                </div>
                <div class="modal-body">
                <%= docs %>
                </div>
            </div>
        </div>
    </div>
    `);

    Buttons.ShowDocs = ShowHelpDocs;

    return Buttons;
});
