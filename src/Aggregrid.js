Ext.define('Jarvus.aggregrid.Aggregrid', {
    extend: 'Ext.Component',
    xtype: 'jarvus-aggregrid',


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
        expandable: false,

        cellTpl: '{records.length}',
        cellRenderer: false,

        componentCls: 'jarvus-aggregrid',
        listeners: {
            click: {
                element: 'el',
                fn: 'onClick'
            }
        },
        tpl: [
            '{% var columnsCount = values.columns.length %}',
            '{% var rowsCount = values.rows.length %}',

            '<div class="jarvus-aggregrid-rowheaders-ct">',
                '<table class="jarvus-aggregrid-rowheaders-table">',
                    '<thead>',
                        '<tr>',
                            '<td class="jarvus-aggregrid-cornercell">',
                                '&nbsp;',
                            '</td>',
                        '</tr>',
                    '</thead>',

                    '<tbody>',
                        '<tpl for="rows">',
                            '<tr class="jarvus-aggregrid-row <tpl if="expandable">is-expandable</tpl>" data-row-id="{id}">',
                                '<th class="jarvus-aggregrid-rowheader">',
                                    '<div class="jarvus-aggregrid-header-text">',
                                        '{% values.rowHeaderTpl.applyOut(values, out, parent) %}',
                                    '</div>',
                                '</th>',
                            '</tr>',

                            // expander infrastructure
                            '<tpl if="expandable">',
                                '<tr class="jarvus-aggregrid-expander" data-row-id="{id}">',
                                    '<td class="jarvus-aggregrid-expander-cell">',
                                        '<div class="jarvus-aggregrid-expander-ct"></div>',
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
                    '<div tabindex="0" class="jarvus-aggregrid-scroll-control is-disabled scroll-left"></div>',
                    '<div tabindex="0" class="jarvus-aggregrid-scroll-control is-disabled scroll-right"></div>',

                    '<table class="jarvus-aggregrid-data-table">',
                        '<thead>',
                            '<tr>',
                                '<tpl for="columns">',
                                    '<th class="jarvus-aggregrid-colheader" data-column-id="{id}">',
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
                                '<tr class="jarvus-aggregrid-row <tpl if="expandable">is-expandable</tpl>" data-row-id="{id}">',
                                    '<tpl for="columns">',
                                        '<td class="jarvus-aggregrid-cell {cls}" data-column-id="{id}">{text}</td>',
                                    '</tpl>',
                                '</tr>',

                                // expander infrastructure
                                '<tpl if="expandable">',
                                    '<tr class="jarvus-aggregrid-expander" data-row-id="{id}">',
                                        '<td class="jarvus-aggregrid-expander-cell" colspan="{[ columnsCount ]}">',
                                            '<div class="jarvus-aggregrid-expander-ct"></div>',
                                        '</td>',
                                    '</tr>',
                                '</tpl>',
                                //
                            '</tpl>',
                        '</tbody>',
                    '</table>',
                '</div>',
            '</div>'
        ]
    },


    // component lifecycle
    afterRender: function() {
        var me = this;

        me.callParent(arguments);

        // chain rendering cells to aggregation with a slight delay
        me.on('aggregate', function() {
            me.fireEventedAction('rendercells', [me], 'doRenderCells', me);
        }, me, { delay: 5 });

        me.refresh();
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

    applyColumnHeaderTpl: function(tpl) {
        if (!tpl) {
            tpl = new Ext.XTemplate(
                '{[typeof values === "string" ? values : values["' + this.getColumnHeaderField() + '"]]}'
            );
        } else if (!tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },

    applyRowHeaderTpl: function(tpl) {
        if (!tpl) {
            tpl = new Ext.XTemplate(
                '{[typeof values === "string" ? values : values["' + this.getRowHeaderField() + '"]]}'
            );
        } else if (!tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },

    applyColumnMapper: function(mapper) {
        if (!Ext.isString(mapper)) {
            return mapper;
        }

        return function(dataRecord, columnsStore) {
            return columnsStore.getById(dataRecord.get(mapper));
        };
    },

    applyRowMapper: function(mapper) {
        if (!Ext.isString(mapper)) {
            return mapper;
        }

        return function(dataRecord, rowsStore) {
            return rowsStore.getById(dataRecord.get(mapper));
        };
    },

    applyCellTpl: function(tpl) {
        if (tpl && !tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
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
            group = aggregateGroups[rowId][columnId];

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

    onDataStoreUpdate: function(store, record) {
        var me = this,
            aggregateGroups = me.aggregateGroups,
            rowsStore = me.getRowsStore(),
            rowMapper = me.getRowMapper(),
            columnsStore = me.getColumnsStore(),
            columnMapper = me.getColumnMapper(),

            recordId = record.getId(),
            recordMetadata = me.recordsMetadata[recordId],
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
        group = aggregateGroups[rowId][columnId];

        // move record to new group
        Ext.Array.remove(previousGroup.records, recordMetadata);
        recordMetadata.previousGroup = previousGroup;
        recordMetadata.group = group;
        group.records.push(recordMetadata);

        me.fireEvent('aggregatechange', me, 'remove', recordMetadata);
    },

    onClick: function(ev, target) {
        var me = this,
            containerEl = me.el;

        if (target = ev.getTarget('.jarvus-aggregrid-rowheader', containerEl, true)) { // eslint-disable-line no-cond-assign
            return me.onRowHeaderClick(
                parseInt(target.up('.jarvus-aggregrid-row').getAttribute('data-row-id'), 10),
                target,
                ev
            );
        }

        if (target = ev.getTarget('.jarvus-aggregrid-colheader', containerEl, true)) { // eslint-disable-line no-cond-assign
            return me.onColumnHeaderClick(
                parseInt(target.getAttribute('data-column-id'), 10),
                target,
                ev
            );
        }

        if (target = ev.getTarget('.jarvus-aggregrid-cell', containerEl, true)) { // eslint-disable-line no-cond-assign
            return me.onCellClick(
                parseInt(target.up('.jarvus-aggregrid-row').getAttribute('data-row-id'), 10),
                parseInt(target.getAttribute('data-column-id'), 10),
                target,
                ev
            );
        }

        return null;
    },

    onRowHeaderClick: function(rowId, el, ev) {
        var me = this,
            isExpand;

        me.fireEvent('rowheaderclick', this, rowId, el, ev);

        if (me.getExpandable()) {
            isExpand = !me.rowExpanded[rowId];
            me.fireEventedAction(isExpand ? 'expand' : 'collapse', [me, rowId, el, ev], isExpand ? 'doExpand' : 'doCollapse', me);
        }
    },

    onColumnHeaderClick: function(columnId, el, ev) {
        this.fireEvent('columnheaderclick', this, columnId, el, ev);
    },

    onCellClick: function(rowId, columnId, el, ev) {
        this.fireEvent('cellclick', this, rowId, columnId, el, ev);
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

        console.info('%s.refresh', this.getId());

        me.fireEventedAction('refresh', [me], 'doRefresh', me);
    }, 10),

    /**
     * @private
     * Render the main scaffolding of the aggregrid by columns and rows
     */
    doRefresh: function(me) {
        var dataStore = me.getDataStore();

        console.info('%s.doRefresh', this.getId());

        // generate template data structure and execute against tpl
        me.setData(me.buildTplData());

        // reset expansion state
        me.rowExpanded = {};

        // do stuff that needs to happen after each time the DOM is rebuilt
        me.afterRefresh();

        // execute initial data aggregation if store is ready
        if (dataStore && dataStore.isLoaded()) {
            me.aggregate();
        }
    },

    buildTplData: function() {
        var me = this,
            expandable = me.getExpandable(),
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
                expandable: expandable,
                columns: columns
            }, rowsStore.getAt(i).getData()));
        }

        return data;
    },

    afterRefresh: function() {
        console.info('%s.afterRefresh', this.getId());

        var me = this,
            expandable = me.getExpandable(),
            rowHeadersCt = me.el.down('.jarvus-aggregrid-rowheaders-table tbody'),
            columnHeadersCt = me.el.down('.jarvus-aggregrid-data-table thead'),
            dataCellsCt = me.el.down('.jarvus-aggregrid-data-table tbody'),

            columnsStore = me.getColumnsStore(),
            columnsCount = columnsStore.getCount(),
            rowsStore = me.getRowsStore(),
            rowsCount = rowsStore.getCount(),

            rowEls = me.rowEls = {},
            rowHeaderEls = me.rowHeaderEls = {},
            rowExpanderEls = me.rowExpanderEls = {},
            rowHeaderExpanderEls = me.rowHeaderExpanderEls = {},
            columnHeaderEls = me.columnHeaderEls = {},
            aggregateGroups = me.aggregateGroups = {},

            rowIndex, row, rowId, rowEl, rowGroups,
            columnIndex, column, columnId;

        // READ phase: query dom to collect references to key elements
        for (rowIndex = 0; rowIndex < rowsCount; rowIndex++) {
            row = rowsStore.getAt(rowIndex);
            rowId = row.getId();
            rowGroups = aggregateGroups[rowId] = {};
            rowEl = rowEls[rowId] = dataCellsCt.down('.jarvus-aggregrid-row[data-row-id="'+rowId+'"]');

            rowHeaderEls[rowId] = rowHeadersCt.down('.jarvus-aggregrid-row[data-row-id="'+rowId+'"]');

            rowExpanderEls[rowId] = expandable && dataCellsCt.down('.jarvus-aggregrid-expander[data-row-id="'+rowId+'"] .jarvus-aggregrid-expander-ct');
            rowHeaderExpanderEls[rowId] = expandable && rowHeadersCt.down('.jarvus-aggregrid-expander[data-row-id="'+rowId+'"] .jarvus-aggregrid-expander-ct');

            for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
                column = columnsStore.getAt(columnIndex);
                columnId = column.getId();

                columnHeaderEls[columnId] = columnHeadersCt.down('.jarvus-aggregrid-colheader[data-column-id="'+columnId+'"]');

                rowGroups[columnId] = {
                    records: [],
                    cellEl: rowEl.down('.jarvus-aggregrid-cell[data-column-id="'+columnId+'"]'),
                    row: row,
                    rowId: rowId,
                    column: column,
                    columnId: columnId
                };
            }
        }

        for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
            columnId = columnsStore.getAt(columnIndex).getId();
            columnHeaderEls[columnId] = columnHeadersCt.down('.jarvus-aggregrid-colheader[data-column-id="'+columnId+'"]');
        }

        // READ->WRITE phase: sync row heights
        me.syncRowHeights();

        me.fireEvent('afterrefresh', me);
    },

    /**
     * @public
     * Synchronizes the heights of rows between the headers and data tables
     */
    syncRowHeights: function() {
        var rowHeaderEls = this.rowHeaderEls,
            rowEls = this.rowEls,
            table1RowHeights = {},
            table2RowHeights = {},
            rowKey, maxHeight;

        Ext.batchLayouts(function() {
            // read all the row height in batch first for both tables
            for (rowKey in rowHeaderEls) { // eslint-disable-line guard-for-in
                table1RowHeights[rowKey] = rowHeaderEls[rowKey].getHeight();
                table2RowHeights[rowKey] = rowEls[rowKey].getHeight();
            }

            // write all the max row heights
            for (rowKey in rowHeaderEls) { // eslint-disable-line guard-for-in
                maxHeight = Math.max(table1RowHeights[rowKey], table2RowHeights[rowKey]);
                rowHeaderEls[rowKey].select('td, th').setHeight(maxHeight);
                rowEls[rowKey].select('td, th').setHeight(maxHeight);
            }
        });
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

        console.info('%s.aggregate', this.getId());

        me.fireEventedAction('aggregate', [me], 'doAggregate', me);
    },

    /**
     * @private
     * Generate the full aggregateGroups structure and flush to DOM
     */
    doAggregate: function(me) {
        console.info('%s.doAggregate', this.getId());

        var aggregateGroups = me.aggregateGroups,
            recordsMetadata = me.recordsMetadata = {},

            rowsStore = me.getRowsStore(),
            rowMapper = me.getRowMapper(),
            columnsStore = me.getColumnsStore(),
            columnMapper = me.getColumnMapper(),
            dataStore = me.getDataStore(),

            recordsCount = dataStore.getCount(),
            recordIndex = 0, record, recordId, recordMetadata,
            row, rowId, column, columnId, group;

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
            group = aggregateGroups[rowId][columnId];

            recordMetadata.group = group;
            group.records.push(recordMetadata);
        }
    },

    doRenderCells: function(me) {
        console.info('%s.doRenderCells', this.getId());

        var aggregateGroups = me.aggregateGroups,
            cellTpl = me.getCellTpl(),
            cellRenderer = me.getCellRenderer(),
            rowId, columns, columnId, group, cellEl;

        if (!cellTpl && !cellRenderer) {
            return;
        }

        for (rowId in aggregateGroups) { // eslint-disable-line guard-for-in
            columns = aggregateGroups[rowId];

            for (columnId in columns) { // eslint-disable-line guard-for-in
                group = columns[columnId];
                cellEl = group.cellEl;

                if (cellTpl) {
                    cellTpl.overwrite(cellEl, group);
                }

                if (cellRenderer) {
                    cellRenderer.call(this, group, cellEl);
                }
            }
        }
    },

    doExpand: function(me, rowId) {
        me.rowExpanded[rowId] = true;
        me.syncExpanderHeight(rowId);
        me.rowEls[rowId].addCls('is-expanded');
        me.rowHeaderEls[rowId].addCls('is-expanded');
    },

    doCollapse: function(me, rowId) {
        me.rowExpanded[rowId] = false;
        me.rowHeaderExpanderEls[rowId].setHeight(0);
        me.rowExpanderEls[rowId].setHeight(0);
        me.rowEls[rowId].removeCls('is-expanded');
        me.rowHeaderEls[rowId].removeCls('is-expanded');
    },

    syncExpanderHeight: function(rowId) {
        var me = this,
            rowHeaderExpanderEl = me.rowHeaderExpanderEls[rowId],
            rowExpanderEl = me.rowExpanderEls[rowId],

            rowHeaderExpanderHeight = rowHeaderExpanderEl.first().getHeight(),
            rowExpanderHeight = rowExpanderEl.first().getHeight(),
            maxHeight = Math.max(rowHeaderExpanderHeight, rowExpanderHeight);

        console.info('%s.syncExpanderHeight(%o) setting to max(%o, %o) = %o', this.getId(), rowId, rowHeaderExpanderHeight, rowExpanderHeight, maxHeight);

        rowHeaderExpanderEl.setHeight(maxHeight);
        rowExpanderEl.setHeight(maxHeight);
    }
});