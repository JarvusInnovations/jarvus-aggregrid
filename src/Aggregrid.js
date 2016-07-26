/**
 * TODO:
 * - [~] Continuously update data cell renderings
 * - [ ] Continuously update rows
 */
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
        this.callParent(arguments);
        this.repaintGrid();
    },


    // config handlers
    applyColumnsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    updateColumnsStore: function(store, oldStore) {
        var me = this;

        if (oldStore) {
            oldStore.un('datachanged', 'refreshGrid', me);
        }

        if (store) {
            me.refreshGrid();
            store.on('datachanged', 'refreshGrid', me);
        }
    },

    applyRowsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    updateRowsStore: function(store, oldStore) {
        var me = this;

        if (oldStore) {
            oldStore.un('datachanged', 'refreshGrid', me);
        }

        if (store) {
            me.refreshGrid();
            store.on('datachanged', 'refreshGrid', me);
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
    onDataStoreLoad: function(dataStore, records) {
        this.groupRecords(records);
    },

    onDataStoreAdd: function(dataStore, records) {
        this.groupRecords(records);
    },

    onDataStoreRemove: function(store, records) {
        this.ungroupRecords(records);
    },

    onDataStoreUpdate: function(store, records) {
        this.regroupRecords([records]);
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
    refreshGrid: function() {
        var me = this,
            columnsStore = me.getColumnsStore(),
            rowsStore = me.getRowsStore(),
            bufferedRefreshGrid = me.bufferedRefreshGrid;

        if (
            !columnsStore || !rowsStore
            || !columnsStore.isLoaded() || !rowsStore.isLoaded()
        ) {
            return;
        }

        if (!bufferedRefreshGrid) {
            bufferedRefreshGrid = me.bufferedRefreshGrid = Ext.Function.createBuffered(me.fireEventedAction, 10, me, ['refreshgrid', [me], 'doRefreshGrid', me]);
        }

        bufferedRefreshGrid();
    },

    /**
     * @private
     * Refresh the internal data structures for rows and columns
     */
    doRefreshGrid: function(me) {
        console.info('%s.doRefreshGrid', this.getId());

        var me = this,
            groups = me.groups = {},

            rowsStore = me.getRowsStore(),
            rowsCount = rowsStore.getCount(),
            rowIndex = 0, row, rowId, rowGroups,

            columnsStore = me.getColumnsStore(),
            columnsCount = columnsStore.getCount(),
            columnIndex, column, columnId,

            dataStore = me.getDataStore();

        me.gridPainted = false;

        // initialize row x column groups map
        for (; rowIndex < rowsCount; rowIndex++) {
            row = rowsStore.getAt(rowIndex);
            rowId = row.getId();
            rowGroups = groups[rowId] = {};

            for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
                column = columnsStore.getAt(columnIndex);
                columnId = column.getId();

                rowGroups[columnId] = {
                    records: [],
                    row: row,
                    rowId: rowId,
                    column: column,
                    columnId: columnId
                };
            }
        }

        // reset expansion state
        me.rowExpanded = {};

        // reset grouped records by-id cache
        me.groupedRecords = {};

        // group any initial data records
        if (dataStore && dataStore.getCount()) {
            me.groupRecords(dataStore.getRange());
        }

        // repaint grid
        if (me.rendered) {
            me.repaintGrid();
        }
    },

    repaintGrid: function() {
        var me = this;

        if (!me.groups || !me.rendered) {
            return;
        }

        me.fireEventedAction('repaintgrid', [me], 'doRepaintGrid', me);
    },

    /**
     * @private
     * Render the main scaffolding of the aggregrid by columns and rows
     */
    doRepaintGrid: function(me) {
        console.info('%s.doRepaintGrid', this.getId());

        var expandable = me.getExpandable(),
            groups = me.groups,

            columnsStore = me.getColumnsStore(),
            columnsCount = columnsStore.getCount(),
            rowsStore = me.getRowsStore(),
            rowsCount = rowsStore.getCount(),

            rowEls = me.rowEls = {},
            rowHeaderEls = me.rowHeaderEls = {},
            rowExpanderEls = me.rowExpanderEls = {},
            rowHeaderExpanderEls = me.rowHeaderExpanderEls = {},
            columnHeaderEls = me.columnHeaderEls = {},
            rowHeadersCt, columnHeadersCt, dataCellsCt,

            rowIndex, row, rowId, rowEl, rowGroups,
            columnIndex, column, columnId;

        // generate template data structure and execute against tpl
        me.setData(me.buildTplData());

        // read top-level containers from dom
        rowHeadersCt = me.rowHeadersCt = me.el.down('.jarvus-aggregrid-rowheaders-table tbody');
        columnHeadersCt = me.rowHeadersCt = me.el.down('.jarvus-aggregrid-data-table thead');
        dataCellsCt = me.dataCellsCt = me.el.down('.jarvus-aggregrid-data-table tbody');

        // READ phase: query dom to collect references to key elements
        for (rowIndex = 0; rowIndex < rowsCount; rowIndex++) {
            row = rowsStore.getAt(rowIndex);
            rowId = row.getId();
            rowGroups = groups[rowId];
            rowEl = rowEls[rowId] = dataCellsCt.down('.jarvus-aggregrid-row[data-row-id="'+rowId+'"]');

            rowHeaderEls[rowId] = rowHeadersCt.down('.jarvus-aggregrid-row[data-row-id="'+rowId+'"]');

            rowExpanderEls[rowId] = expandable && dataCellsCt.down('.jarvus-aggregrid-expander[data-row-id="'+rowId+'"] .jarvus-aggregrid-expander-ct');
            rowHeaderExpanderEls[rowId] = expandable && rowHeadersCt.down('.jarvus-aggregrid-expander[data-row-id="'+rowId+'"] .jarvus-aggregrid-expander-ct');

            for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
                column = columnsStore.getAt(columnIndex);
                columnId = column.getId();

                columnHeaderEls[columnId] = columnHeadersCt.down('.jarvus-aggregrid-colheader[data-column-id="'+columnId+'"]');

                rowGroups[columnId].cellEl = rowEl.down('.jarvus-aggregrid-cell[data-column-id="'+columnId+'"]');
            }
        }

        for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
            columnId = columnsStore.getAt(columnIndex).getId();
            columnHeaderEls[columnId] = columnHeadersCt.down('.jarvus-aggregrid-colheader[data-column-id="'+columnId+'"]');
        }

        // READ->WRITE phase: sync row heights
        me.syncRowHeights();

        me.gridPainted = true;

        // repaint data
        me.repaintData();
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

    groupRecords: function(records) {
        var me = this,
            groups = me.groups,
            groupedRecords = me.groupedRecords,

            rowsStore = me.getRowsStore(),
            rowMapper = me.getRowMapper(),
            columnsStore = me.getColumnsStore(),
            columnMapper = me.getColumnMapper(),

            recordsLength = records.length,
            i = 0, record, recordId, recordGroupData,
            row, column, rowId, columnId, group;

        if (!groupedRecords) {
            return;
        }

        for (; i < recordsLength; i++) {
            record = records[i];
            recordId = record.getId();

            // get target row and column for this record
            row = rowMapper(record, rowsStore);
            column = columnMapper(record, columnsStore);

            if (!row || !column) {
                Ext.Logger.warn('Data record ' + recordId + ' not matched to ' + (row ? 'column' : 'row'));
                continue;
            }

            // create metadata container for record indexed by its id
            recordGroupData = groupedRecords[recordId] = {
                record: record,
                row: row,
                column: column
            };

            // push record to records array for group at [rowId][columnId]
            rowId = row.getId();
            columnId = column.getId();
            group = groups[rowId][columnId];

            recordGroupData.group = group;
            group.records.push(recordGroupData);

            // mark group dirty
            group.dirty = true;

            me.fireEvent('recordgrouped', me, recordGroupData, group);
        }

        me.repaintData();
    },

    ungroupRecords: function(records) {
        var me = this,
            groupedRecords = me.groupedRecords,
            recordsLength = records.length,
            i = 0, record, recordId, recordGroupData, group;

        if (!groupedRecords) {
            return;
        }

        for (; i < recordsLength; i++) {
            record = records[i];
            recordId = record.getId();
            recordGroupData = groupedRecords[recordId];

            if (!recordGroupData) {
                continue; // this record was not rendered into a group
            }

            group = recordGroupData.group;

            // remove from group
            Ext.Array.remove(recordGroupData.group.records, recordGroupData);
            delete recordGroupData.group;

            // remove metadata
            delete groupedRecords[recordId];

            // mark group dirty
            group.dirty = true;

            me.fireEvent('recordungrouped', me, recordGroupData, group);
        }

        me.repaintData();
    },

    regroupRecords: function(records) {
        var me = this,
            groups = me.groups,
            groupedRecords = me.groupedRecords,

            rowsStore = me.getRowsStore(),
            rowMapper = me.getRowMapper(),
            columnsStore = me.getColumnsStore(),
            columnMapper = me.getColumnMapper(),

            recordsLength = records.length,
            i = 0, record, recordId, recordGroupData, previousGroup,
            row, column, rowId, columnId, group,
            ungroupedRecords = [];

        if (!groupedRecords) {
            return;
        }

        for (; i < recordsLength; i++) {
            record = records[i];
            recordId = record.getId();
            recordGroupData = groupedRecords[recordId];

            if (!recordGroupData) {
                ungroupedRecords.push(record);
                continue;
            }

            previousGroup = recordGroupData.group;

            // get updated target row and column for this record
            row = rowMapper(record, rowsStore);
            column = columnMapper(record, columnsStore);

            if (!row || !column) {
                Ext.Logger.warn('Data record ' + recordId + ' not matched to ' + (row ? 'column' : 'row'));
                return;
            }

            // check if record needs to be moved to a new group
            if (row === recordGroupData.row && column === recordGroupData.column) {
                return;
            }

            // get new group
            rowId = row.getId();
            columnId = column.getId();
            group = groups[rowId][columnId];

            // move record to new group
            Ext.Array.remove(previousGroup.records, recordGroupData);
            recordGroupData.previousGroup = previousGroup;
            recordGroupData.group = group;
            group.records.push(recordGroupData);

            // mark group dirty
            group.dirty = true;

            me.fireEvent('recordregrouped', me, recordGroupData, group, previousGroup);
        }

        if (ungroupedRecords.length) {
            me.groupRecords(ungroupedRecords);
        }

        me.repaintData();
    },

    repaintData: function() {
        var me = this,
            bufferedRepaintData = me.bufferedRepaintData;

        if (!me.gridPainted) {
            return;
        }

        if (!bufferedRepaintData) {
            bufferedRepaintData = me.bufferedRepaintData = Ext.Function.createBuffered(me.fireEventedAction, 10, me, ['repaintdata', [me], 'doRepaintData', me]);
        }

        bufferedRepaintData();
    },

    doRepaintData: function(me) {
        console.info('%s.doRepaintData', this.getId());

        var groups = me.groups,
            cellTpl = me.getCellTpl(),
            cellRenderer = me.getCellRenderer(),
            rowId, columns, columnId, group, cellEl, rendered, dirty;

        if (!cellTpl && !cellRenderer) {
            return;
        }

        for (rowId in groups) { // eslint-disable-line guard-for-in
            columns = groups[rowId];

            for (columnId in columns) { // eslint-disable-line guard-for-in
                group = columns[columnId];
                cellEl = group.cellEl;
                rendered = group.rendered;
                dirty = group.dirty

                // apply cellTpl if this is the first render OR there's no cellRenderer and the group is dirty
                if (!rendered || (!cellRenderer && dirty)) {
                    group.tplNode = cellTpl && cellTpl.overwrite(cellEl, group);
                }

                if (!rendered || dirty) {
                    group.rendered = cellRenderer && cellRenderer.call(me, group, cellEl, rendered || false) || true;
                    group.dirty = false;
                }
            }
        }

        me.cellsRendered = true;
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