Ext.define('Jarvus.aggregrid.RollupAggregrid', {
    extend: 'Jarvus.aggregrid.Aggregrid',


    config: {
        rollupRowsStore: null,
        rollupDataStore: null,
        rollupRowHeaderField: 'title',
        rollupRowHeaderTpl: false,
        rollupRowMapper: false,
        rollupCellTpl: '{records.length}',
        rollupRenderer: false
    },


    // config handlers
    applyRollupRowsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    // updateRollupRowsStore: function(store, oldStore) {
    //     var me = this;

    //     if (oldStore) {
    //         oldStore.un('datachanged', 'refresh', me);
    //     }

    //     if (store) {
    //         me.refresh();
    //         store.on('datachanged', 'refresh', me);
    //     }
    // },

    applyRollupDataStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    // updateRollupDataStore: function(store, oldStore) {
    //     var me = this,
    //         listeners = {
    //             scope: me,
    //             load: 'onDataStoreLoad',
    //             add: 'onDataStoreAdd',
    //             remove: 'onDataStoreRemove',
    //             update: 'onDataStoreUpdate'
    //         };

    //     if (oldStore) {
    //         oldStore.un(listeners);
    //     }

    //     if (store) {
    //         store.on(listeners);
    //     }
    // },

    applyRollupRowHeaderTpl: function(tpl) {
        if (!tpl) {
            tpl = new Ext.XTemplate(
                '{[typeof values === "string" ? values : values["' + this.getRollupRowHeaderField() + '"]]}'
            );
        } else if (!tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },

    applyRollupRowMapper: function(mapper) {
        if (!Ext.isString(mapper)) {
            return mapper;
        }

        return function(dataRecord, rowsStore) {
            return rowsStore.getById(dataRecord.get(mapper));
        };
    },

    applyRollupCellTpl: function(tpl) {
        if (tpl && !tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    }


    // event handlers
});