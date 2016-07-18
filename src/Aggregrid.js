Ext.define('Jarvus.aggregrid.Aggregrid', {
    extend: 'Ext.Component',

    // TODO: reorder configs and update/apply functions
    // TODO: document events
    // TODO: write tests for adding/removing data records
    config: {
        columnsStore: null,
        rowsStore: null,
        dataStore: null,

        columnHeaderField: 'title',
        columnHeaderTpl: false,
        columnMapper: 'column_id',

        rowHeaderField: 'title',
        rowHeaderTpl: false,
        rowMapper: 'row_id',

        componentCls: 'jarvus-aggregrid'
    },


    tpl: [
        '{% var columnsCount = values.columns.length %}',
        '{% var rowsCount = values.rows.length %}',

        '<div class="jarvus-aggregrid-rowheaders-ct">',
            '<table class="jarvus-aggregrid-rowheaders-table">',
                '<thead>',
                    '<tr>',
                        '<td class="jarvus-aggregrid-cornercell">&nbsp;</td>',
                    '</tr>',
                '</thead>',

                '<tbody>',
                    '<tpl for="rows">',
                        '<tr class="jarvus-aggregrid-row">',
                            '<th class="jarvus-aggregrid-rowheader">',
                                '<div class="jarvus-aggregrid-header-text">',
                                    '{% values.rowHeaderTpl.applyOut(values, out, parent) %}',
                                '</div>',
                            '</th>',
                        '</tr>',

                        // expander infrastructure
                        '<tpl if="values.rows && values.rows.length">',
                            '<tr class="jarvus-aggregrid-expander">',
                                '<td class="jarvus-aggregrid-expander-cell">',
                                    '<div class="jarvus-aggregrid-expander-ct">',
                                        '<table class="jarvus-aggregrid-expander-table">',
                                            '<tbody>',
                                            //
                                                '<tpl for="rows">',
                                                    '<tr class="jarvus-aggregrid-subrow">',
                                                        '<th class="jarvus-aggregrid-rowheader">',
                                                            '<span class="jarvus-aggregrid-header-text">',
                                                                '{% ;(values.rowHeaderTpl||parent.rowHeaderTpl).applyOut(values, out, parent) %}',
                                                            '</span>',
                                                        '</th>',
                                                    '</tr>',
                                                '</tpl>',

                                            //
                                            '</tbody>',
                                        '</table>',
                                    '</div>',
                                '</td>',
                            '</tr>',
                        '</tpl>',
                        //
                    '</tpl>',
                '</tbody>',
            '</table>',
        '</div>',

        '<div class="jarvus-aggregrid-scroller">',
            '<div class="jarvus-aggregrid-data-ct">',
                '<table class="jarvus-aggregrid-data-table">',
                    '<thead>',
                        '<tr>',
                            '<tpl for="columns">',
                                '<th class="jarvus-aggregrid-colheader">',
                                    '<div class="jarvus-aggregrid-header-clip">',
                                        '<a class="jarvus-aggregrid-header-link" href="javascript:void(0)">',
                                            '<span class="jarvus-aggregrid-header-text">',
                                                 '{% values.columnHeaderTpl.applyOut(values, out, parent) %}',
                                            '</span>',
                                        '</a>',
                                    '</div>',
                                '</th>',
                            '</tpl>',
                        '</tr>',
                    '</thead>',

                    '<tbody>',
                        '<tpl for="rows">',
                            '<tr class="jarvus-aggregrid-row">',
                                '<tpl for="columns">',
                                    '<td class="jarvus-aggregrid-cell">{text}</td>',
                                '</tpl>',
                            '</tr>',

                            // expander infrastructure
                            '<tpl if="values.rows && values.rows.length">',
                                '<tr class="jarvus-aggregrid-expander">',
                                    '<td class="jarvus-aggregrid-expander-cell" colspan="{[ columnsCount ]}">',
                                        '<div class="jarvus-aggregrid-expander-ct">',
                                            '<table class="jarvus-aggregrid-expander-table">',
                                                '<tbody>',
                                                //

                                                    '<tpl for="rows">',
                                                        '<tr class="jarvus-aggregrid-subrow">',
                                                            '<tpl for="columns">',
                                                                '<td class="jarvus-aggregrid-cell">{text}</td>',
                                                            '</tpl>',
                                                        '</tr>',
                                                    '</tpl>',

                                                //
                                                '</tbody>',
                                            '</table>',
                                        '</div>',
                                    '</td>',
                                '</tr>',
                            '</tpl>',
                            //
                        '</tpl>',
                    '</tbody>',
                '</table>',
            '</div>',
        '</div>'
    ],


    // component lifecycle
    afterRender: function() {
        this.callParent(arguments);

        this.refresh();
    },


    // config handlers
    applyColumnsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    updateColumnsStore: function(store, oldStore) {
        var me = this;

        if (oldStore) {
            oldStore.un('datachanged', 'refresh', me);
        }

        if (store) {
            me.refresh();
            store.on('datachanged', 'refresh', me);
        }
    },

    applyRowsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    updateRowsStore: function(store, oldStore) {
        var me = this;

        if (oldStore) {
            oldStore.un('datachanged', 'refresh', me);
        }

        if (store) {
            me.refresh();
            store.on('datachanged', 'refresh', me);
        }
    },

    applyDataStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    updateDataStore: function(store, oldStore) {
        var me = this,
            listeners = {
                scope: me,
                load: 'onDataStoreLoad',
                add: 'onDataStoreAdd',
                remove: 'onDataStoreRemove',
                update: 'onDataStoreUpdate'
            };

        if (oldStore) {
            oldStore.un(listeners);
        }

        if (store) {
            store.on(listeners);
        }
    },

    applyColumnHeaderTpl: function(columnHeaderTpl) {
        var me = this;

        if (!columnHeaderTpl) {
            columnHeaderTpl = new Ext.XTemplate(
                '{[typeof values === "string" ? values : values["' + me.getColumnHeaderField() + '"]]}'
            );
        } else if (!columnHeaderTpl.isTemplate) {
            columnHeaderTpl = new Ext.XTemplate(columnHeaderTpl);
        }

        return columnHeaderTpl;
    },

    applyRowHeaderTpl: function(rowHeaderTpl) {
        var me = this;

        if (!rowHeaderTpl) {
            rowHeaderTpl = new Ext.XTemplate(
                '{[typeof values === "string" ? values : values["' + me.getRowHeaderField() + '"]]}'
            );
        } else if (!rowHeaderTpl.isTemplate) {
            rowHeaderTpl = new Ext.XTemplate(rowHeaderTpl);
        }

        return rowHeaderTpl;
    },

    applyColumnMapper: function(columnMapper) {
        if (!Ext.isString(columnMapper)) {
            return columnMapper;
        }

        return function(dataRecord, columnsStore) {
            return columnsStore.getById(dataRecord.get(columnMapper));
        };
    },

    applyRowMapper: function(rowMapper) {
        if (!Ext.isString(rowMapper)) {
            return rowMapper;
        }

        return function(dataRecord, rowsStore) {
            return rowsStore.getById(dataRecord.get(rowMapper));
        };
    },


    // event handlers
    onDataStoreLoad: function() {
        // call aggregate if initial refresh has already populated tpl data
        if (this.getData()) {
            this.aggregate();
        }
    },

    onDataStoreAdd: function(dataStore, records) {
        var me = this,
            recordsMetadata = me.recordsMetadata,
            aggregateGroups = me.aggregateGroups,
            rowsStore = me.getRowsStore(),
            rowMapper = me.getRowMapper(),
            columnsStore = me.getColumnsStore(),
            columnMapper = me.getColumnMapper(),

            recordsLength = records.length,
            i = 0, record, recordId, recordMetadata,
            row, column, rowId, columnId, group;

        for (; i < recordsLength; i++) {
            record = records[i];
            recordId = record.getId();

            // get target row and column for this record
            row = rowMapper(record, rowsStore);
            column = columnMapper(record, columnsStore);

            if (!row || !column) {
                Ext.Logger.warn('Data record ' + recordId + ' not matched to ' + (row ? 'column' : 'row'));
                return;
            }

            // create metadata container for record indexed by its id
            recordMetadata = recordsMetadata[recordId] = {
                record: record,
                row: row,
                column: column
            };

            // push record to records array for group at [rowId][columnId]
            rowId = row.getId();
            columnId = column.getId();

            group = aggregateGroups[rowId] || (aggregateGroups[rowId] = {});
            group = group[columnId] || (group[columnId] = { records: [] });

            recordMetadata.group = group;
            group.records.push(recordMetadata);

            me.fireEvent('aggregatechange', me, 'add', recordMetadata);
        }
    },

    onDataStoreRemove: function(store, records) {
        var me = this,
            recordsMetadata = me.recordsMetadata,
            recordsLength = records.length,
            i = 0, record, recordId, recordMetadata;

        for (; i < recordsLength; i++) {
            record = records[i];
            recordId = record.getId();
            recordMetadata = recordsMetadata[recordId];

            // remove from group
            Ext.Array.remove(recordMetadata.group.records, recordMetadata);

            // remove metadata
            delete recordsMetadata[recordId];

            me.fireEvent('aggregatechange', me, 'remove', recordMetadata);
        }
    },

    onDataStoreUpdate: function(store, record, operation) {
        var me = this,
            aggregateGroups = me.aggregateGroups,
            rowsStore = me.getRowsStore(),
            rowMapper = me.getRowMapper(),
            columnsStore = me.getColumnsStore(),
            columnMapper = me.getColumnMapper(),

            recordMetadata = me.recordsMetadata[record.getId()],
            previousGroup = recordMetadata.group,
            row, column, rowId, columnId, group;

        // get updated target row and column for this record
        row = rowMapper(record, rowsStore);
        column = columnMapper(record, columnsStore);

        if (!row || !column) {
            Ext.Logger.warn('Data record ' + recordId + ' not matched to ' + (row ? 'column' : 'row'));
            return;
        }

        // check if record needs to be moved to a new group
        if (row === recordMetadata.row && column === recordMetadata.column) {
            return;
        }

        // get new group
        rowId = row.getId();
        columnId = column.getId();
        group = aggregateGroups[rowId] || (aggregateGroups[rowId] = {});
        group = group[columnId] || (group[columnId] = { records: [] });

        // move record to new group
        Ext.Array.remove(previousGroup.records, recordMetadata);
        recordMetadata.previousGroup = previousGroup;
        recordMetadata.group = group;
        group.records.push(recordMetadata);

        me.fireEvent('aggregatechange', me, 'remove', recordMetadata);
    },


    // component methods
    refresh: Ext.Function.createBuffered(function() {
        var me = this,
            columnsStore = me.getColumnsStore(),
            rowsStore = me.getRowsStore();

        if (
            !columnsStore || !rowsStore
            || !columnsStore.isLoaded() || !rowsStore.isLoaded()
        ) {
            return;
        }

        console.info('refresh');

        me.fireEventedAction('refresh', [me], 'doRefresh', me);
    }, 10),

    /**
     * @private
     * Render the main scaffolding of the aggregrid by columns and rows
     */
    doRefresh: function() {
        var me = this,
            dataStore = me.getDataStore();

        console.info('doRefresh');

        me.setData(me.buildTplData());

        if (!me.aggregateGroups && dataStore && dataStore.isLoaded()) {
            me.aggregate();
        }
    },

    /**
     * Triggers a complete rebuild of aggregateGroups structure
     */
    aggregate: function() {
        var me = this,
            store = me.getDataStore();

        if (!store || !store.isLoaded()) {
            return;
        }

        console.info('aggregate');

        me.fireEventedAction('aggregate', [me], 'doAggregate', me);
    },

    /**
     * @private
     * Generate the full aggregateGroups structure and flush to DOM
     */
    doAggregate: function() {
        console.info('doAggregate');

        var me = this,
            rowsStore = me.getRowsStore(),
            rowMapper = me.getRowMapper(),
            columnsStore = me.getColumnsStore(),
            columnMapper = me.getColumnMapper(),
            dataStore = me.getDataStore(),

            recordsCount = dataStore.getCount(),
            recordIndex = 0, record, recordId, recordMetadata,
            row, rowId, column, columnId, group,
            aggregateGroups = {},
            recordsMetadata = {};

        for (; recordIndex < recordsCount; recordIndex++) {
            record = dataStore.getAt(recordIndex);
            recordId = record.getId();

            // get target row and column for this record
            row = rowMapper(record, rowsStore);
            column = columnMapper(record, columnsStore);

            if (!row || !column) {
                Ext.Logger.warn('Data record ' + recordId + ' not matched to ' + (row ? 'column' : 'row'));
                continue;
            }

            // create metadata container for record indexed by its id
            recordMetadata = recordsMetadata[recordId] = {
                record: record,
                row: row,
                column: column
            };

            // push record to records array for group at [rowId][columnId]
            rowId = row.getId();
            columnId = column.getId();

            group = aggregateGroups[rowId] || (aggregateGroups[rowId] = {});
            group = group[columnId] || (group[columnId] = { records: [] });

            recordMetadata.group = group;
            group.records.push(recordMetadata);
        }

        me.aggregateGroups = aggregateGroups;
        console.log('built aggregateGroups: ', aggregateGroups);

        me.recordsMetadata = recordsMetadata;
        console.log('built recordsMetadata: ', recordsMetadata);
    },

    buildTplData: function() {
        var me = this,
            columnsStore = me.getColumnsStore(),
            columnsCount = columnsStore.getCount(),
            columnHeaderTpl = me.getColumnHeaderTpl(),

            rowsStore = me.getRowsStore(),
            rowsCount = rowsStore.getCount(),
            rowHeaderTpl = me.getRowHeaderTpl(),

            i,
            data = {},
            columns = data.columns = [],
            rows = data.rows = [];

        for (i = 0; i < columnsCount; i++) {
            columns.push(Ext.apply({
                columnHeaderTpl: columnHeaderTpl
            }, columnsStore.getAt(i).getData()));
        }

        for (i = 0; i < rowsCount; i++) {
            rows.push(Ext.apply({
                rowHeaderTpl: rowHeaderTpl,
                columns: columns
            }, rowsStore.getAt(i).getData()));
        }

        return data;
    }
});