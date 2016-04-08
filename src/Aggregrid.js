Ext.define('Jarvus.aggregrid.Aggregrid', {
    extend: 'Ext.Component',


    config: {
        columnsStore: null,
        rowsStore: null
    },

    html: 'Hello World',


    // config handlers
    applyColumnsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    applyRowsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    }
});