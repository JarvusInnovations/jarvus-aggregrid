/**
 * ## Lifecycle
 * See https://docs.google.com/drawings/d/1zOGHU8kRRCXe4SwyS6UOtjKA7cvWaWJ4t9BS-wWbyLU/edit?usp=sharing
 *
 * ## TODO
 * - [X] Continuously update data cell renderings
 * - [X] Continuously add rows
 * - [X] Implement scroll locking
 * - [ ] Continuously update/remove rows without refresh
 * - [ ] Respect row/column orders from store
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
        }
    },


    renderTpl: [
        '<div class="jarvus-aggregrid-rowheaders-ct">',
            '<table class="jarvus-aggregrid-rowheaders-table">',
                '<thead>',
                    '<tr>',
                        '<td class="jarvus-aggregrid-cornercell">',
                            '&nbsp;',
                        '</td>',
                    '</tr>',
                '</thead>',

                '<tbody id="{id}-headerRowsCt" data-ref="headerRowsCt"></tbody>',
            '</table>',
        '</div>',

        '<div class="jarvus-aggregrid-scroller">',
            '<div class="jarvus-aggregrid-data-ct">',
                '<div tabindex="0" class="jarvus-aggregrid-scroll-control is-disabled scroll-left"></div>',
                '<div tabindex="0" class="jarvus-aggregrid-scroll-control is-disabled scroll-right"></div>',

                '<table class="jarvus-aggregrid-data-table">',
                    '<thead>',
                        '<tr id="{id}-columnHeadersCt" data-ref="columnHeadersCt"></tr>',
                    '</thead>',

                    '<tbody id="{id}-rowsCt" data-ref="rowsCt"></tbody>',
                '</table>',
            '</div>',
        '</div>'
    ],

    childEls: [
        'columnHeadersCt',
        'headerRowsCt',
        'rowsCt'
    ],

    columnHeadersTpl: [
        '<tpl for=".">',
            '<th class="jarvus-aggregrid-colheader" data-column-id="{id}">',
                '<div class="jarvus-aggregrid-header-clip">',
                    '<a class="jarvus-aggregrid-header-link" href="javascript:void(0)">',
                        '<span class="jarvus-aggregrid-header-text">',
                            '{% values.columnHeaderTpl.applyOut(values, out) %}',
                        '</span>',
                    '</a>',
                '</div>',
            '</th>',
        '</tpl>'
    ],

    headerRowsTpl: [
        '<tpl for=".">',
            '<tr class="jarvus-aggregrid-row <tpl if="expandable">is-expandable</tpl>" data-row-id="{id}">',
                '<th class="jarvus-aggregrid-rowheader">',
                    '<div class="jarvus-aggregrid-header-text">',
                        '{% values.rowHeaderTpl.applyOut(values, out) %}',
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
        '</tpl>'
    ],

    rowsTpl: [
        '<tpl for=".">',
            '<tr class="jarvus-aggregrid-row <tpl if="expandable">is-expandable</tpl>" data-row-id="{rowId}">',
                '<tpl for="columns">',
                    '<td class="jarvus-aggregrid-cell" data-column-id="{columnId}"></td>',
                '</tpl>',
            '</tr>',

            // expander infrastructure
            '<tpl if="expandable">',
                '<tr class="jarvus-aggregrid-expander" data-row-id="{rowId}">',
                    '<td class="jarvus-aggregrid-expander-cell" colspan="{columns.length}">',
                        '<div class="jarvus-aggregrid-expander-ct"></div>',
                    '</td>',
                '</tr>',
            '</tpl>',
        '</tpl>'
    ],


    // component lifecycle overrides
    constructor: function() {
        var me = this;

        // initialize internal data structures before configuration gets initialized
        me.columnsMap = {};
        me.columns = [];
        me.rowsMap = {};
        me.rows = [];

        me.recordsMap = {};
        me.ungroupedRecords = [];

        // continue with component construction and configuration initialization
        me.callParent(arguments);
    },

    afterRender: function() {
        var me = this;

        me.callParent(arguments);
        me.paintColumns();
        me.paintRows();
        // me.paintData();
    },


    // config handlers
    applyColumnsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    updateColumnsStore: function(store, oldStore) {
        var me = this,
            listeners = {
                scope: me,
                load: 'onColumnsStoreLoad',
                add: 'onColumnsStoreAdd',
                remove: 'onColumnsStoreRemove',
                update: 'onColumnsStoreUpdate'
            };

        if (oldStore) {
            oldStore.un(listeners);
        }

        if (store) {
            if (store.isLoaded()) {
                // if store is already loaded, trigger load handler now
                me.onColumnsStoreLoad(store, store.getRange());
            }

            store.on(listeners);
        }
    },

    applyRowsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    updateRowsStore: function(store, oldStore) {
        var me = this,
            listeners = {
                scope: me,
                load: 'onRowsStoreLoad',
                add: 'onRowsStoreAdd',
                remove: 'onRowsStoreRemove',
                update: 'onRowsStoreUpdate'
            };

        if (oldStore) {
            oldStore.un(listeners);
        }

        if (store) {
            if (store.isLoaded()) {
                // if store is already loaded, trigger load handler now
                me.onRowsStoreLoad(store, store.getRange());
            }

            store.on(listeners);
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
                '{[typeof values === "string" ? values : values.data["' + this.getColumnHeaderField() + '"]]}'
            );
        } else if (!tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },

    applyRowHeaderTpl: function(tpl) {
        if (!tpl) {
            tpl = new Ext.XTemplate(
                '{[typeof values === "string" ? values : values.data["' + this.getRowHeaderField() + '"]]}'
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
            return rowsStore.getData().get(dataRecord.get(mapper));
        };
    },

    applyCellTpl: function(tpl) {
        if (tpl && !tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },


    // event handlers

    /**
     * When new columns are loaded, do the same as onSubRowsStoreAdd
     */
    onColumnsStoreLoad: function(columnsStore, loadedColumns) {
        this.onColumnsStoreAdd(columnsStore, loadedColumns, 0);
    },

    /**
     * When new columns are added:
     * - Initialize `columns` render data object keyed to id
     * - TODO: Scan through ungroupedRecords to find any that can now be grouped to the new columns
     * - Paint unrendered columns
     */
    onColumnsStoreAdd: function(columnsStore, addedColumns, index) {
        console.log('onColumnsStoreAdd(%o, %s: %o)', columnsStore, addedColumns.length, addedColumns);

        var me = this,
            columnsMap = me.columnsMap,
            addedColumnsLength = addedColumns.length,
            addedColumnsIndex = 0, column, columnId,
            addedColumnsRenderData = [];

        for (; addedColumnsIndex < addedColumnsLength; addedColumnsIndex++) {
            column = addedColumns[addedColumnsIndex];
            columnId = column.getId();

            addedColumnsRenderData.push(columnsMap[columnId] = me.buildColumnRenderData(column));
        }

        Ext.Array.insert(me.columns, index, addedColumnsRenderData);

        me.paintColumns();
    },

    /**
     * When new columns are added:
     * - TODO: Move any grouped records to ungrouped
     * - Destroy `columns` metadata object keyed to id
     * - Unpoint rendered columns
     */
    onColumnsStoreRemove: function(columnsStore, removedColumns, index) {
        console.log('onColumnsStoreRemove(%o, %s: %o)', columnsStore, removedColumns.length, removedColumns);

        var me = this,
            columnsMap = me.columnsMap,
            removedColumnsLength = removedColumns.length,
            removedColumnIndex = 0, row, columnId, headerEl;

        for (; removedColumnIndex < removedColumnsLength; removedColumnIndex++) {
            row = removedColumns[removedColumnIndex];
            columnId = row.getId();
            headerEl = columnsMap[columnId].headerEl;

            if (headerEl) {
                headerEl.destroy();
            }

            delete columnsMap[columnId];
        }

        Ext.Array.removeAt(me.columns, index, removedColumns.length);
    },

    /**
     * When columns are updated:
     * - TODO: Scan through all records grouped to updated columns and regroup them
     * - TODO: Scan through ungroupedRecords to find any that can now be grouped to the updated columns
     * - TODO: Update column header content if columnHeaderTpl is configured or columnHeaderField is updated
     */
    onColumnsStoreUpdate: function(columnsStore, updatedColumns) {
        console.log('onColumnsStoreUpdate(%o, %s: %o)', columnsStore, updatedColumns.length, updatedColumns);
        // this.refreshGrid();
        // TODO: ungroup data records
    },

    /**
     * When new rows are loaded, do the same as onSubRowsStoreAdd
     */
    onRowsStoreLoad: function(rowsStore, loadedRows) {
        this.onRowsStoreAdd(rowsStore, loadedRows, 0);
    },

    /**
     * When new rows are added:
     * - Initialize `rows` render data object keyed to id
     * - TODO: Scan through ungroupedRecords to find any that can now be grouped to the new rows
     * - Paint unrendered rows
     */
    onRowsStoreAdd: function(rowsStore, addedRows, index) {
        console.log('onRowsStoreAdd(%o, %s: %o)', rowsStore, addedRows.length, addedRows);

        var me = this,
            rowsMap = me.rowsMap,
            addedRowsLength = addedRows.length,
            addedRowsIndex = 0, row, rowId,
            addedRowsRenderData = [];

        for (; addedRowsIndex < addedRowsLength; addedRowsIndex++) {
            row = addedRows[addedRowsIndex];
            rowId = row.getId();

            addedRowsRenderData.push(rowsMap[rowId] = me.buildRowRenderData(row));
        }

        Ext.Array.insert(me.rows, index, addedRowsRenderData);

        me.paintRows();
        // var me = this,
        //     expandable = me.getExpandable(),
        //     rendered = me.rendered,
        //     groups = me.groups,
        //     rowHeadersCt = me.rowHeadersCt,
        //     dataCellsCt = me.dataCellsCt,
        //     headerRowEls = me.headerRowEls,
        //     rowEls = me.rowEls,
        //     headerRowExpanderEls = me.headerRowExpanderEls,
        //     rowExpanderEls = me.rowExpanderEls,

        //     headerRowsTpl = me.getTpl('headerRowsTpl'),
        //     rowsTpl = me.getTpl('rowsTpl'),
        //     rowsLength = rows.length, rowIndex, row, rowId, rowGroups, rowEl,
        //     rowsTplData = [],
        //     renderedRowIds = [],

        //     columnsData = (me.getData()||{}).columns || [],
        //     columnsStore = me.getColumnsStore(),
        //     columnsCount = columnsStore.getCount(),
        //     columnIndex, column, columnId;

        // // WRITE PHASE: execute rows tpl data array against templates
        // if (rendered) {
        //     for (rowIndex = 0; rowIndex < rowsLength; rowIndex++) {
        //         rowsTplData.push(me.buildRowTplData(rows[rowIndex], columnsData));
        //     }

        //     headerRowsTpl.append(rowHeadersCt, rowsTplData);
        //     rowsTpl.append(dataCellsCt, rowsTplData);
        // }

        // // READ phase: query DOM to collect references to key elements
        // for (rowIndex = 0; rowIndex < rowsLength; rowIndex++) {
        //     row = rows[rowIndex];
        //     rowId = row.getId();
        //     rowGroups = groups[rowId] = {};

        //     if (rendered) {
        //         headerRowEls[rowId] = rowHeadersCt.down('.jarvus-aggregrid-row[data-row-id="'+rowId+'"]');
        //         rowEl = rowEls[rowId] = dataCellsCt.down('.jarvus-aggregrid-row[data-row-id="'+rowId+'"]');

        //         rowExpanderEls[rowId] = expandable && dataCellsCt.down('.jarvus-aggregrid-expander[data-row-id="'+rowId+'"] .jarvus-aggregrid-expander-ct');
        //         headerRowExpanderEls[rowId] = expandable && rowHeadersCt.down('.jarvus-aggregrid-expander[data-row-id="'+rowId+'"] .jarvus-aggregrid-expander-ct');

        //         renderedRowIds.push(rowId);
        //     }

        //     for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
        //         column = columnsStore.getAt(columnIndex);
        //         columnId = column.getId();

        //         rowGroups[columnId] = {
        //             records: [],
        //             row: row,
        //             rowId: rowId,
        //             column: column,
        //             columnId: columnId,
        //             cellEl: rendered && rowEl.down('.jarvus-aggregrid-cell[data-column-id="'+columnId+'"]') || null
        //         };
        //     }
        // }

        // // regroup data
        // me.groupUngroupedRecords(false);

        // // no futher work is needed if the grid has not rendered yet
        // if (!rendered) {
        //     return;
        // }

        // // READ->WRITE phase: sync row heights
        // me.syncRowHeights(renderedRowIds);

        // // repaint cells
        // me.repaintCells(renderedRowIds);
    },

    /**
     * When new rows are added:
     * - TODO: Move any grouped records to ungrouped
     * - Destroy `rows` metadata object keyed to id
     */
    onRowsStoreRemove: function(rowsStore, removedRows, index) {
        console.log('onRowsStoreRemove(%o, %s: %o)', rowsStore, removedRows.length, removedRows);

        var me = this,
            rowsMap = me.rowsMap,
            removedRowsLength = removedRows.length,
            removedRowIndex = 0, row, rowId,
            rowRenderData, rowEl, expanderEl;


        for (; removedRowIndex < removedRowsLength; removedRowIndex++) {
            row = removedRows[removedRowIndex];
            rowId = row.getId();
            rowRenderData = rowsMap[rowId];
            rowEl = rowRenderData.rowEl;
            expanderEl = rowRenderData.expanderEl;

            if (rowEl) {
                rowEl.destroy();
            }

            if (expanderEl) {
                expanderEl.destroy();
            }

            delete rowsMap[rowId];
        }

        Ext.Array.removeAt(me.rows, index, removedRows.length);

        // this.refreshGrid();
    },

    /**
     * When rows are updated:
     * - TODO: Scan through all records grouped to updated rows and regroup them
     * - TODO: Scan through ungroupedRecords to find any that can now be grouped to the updated rows
     * - TODO: Update row header content if rowHeaderTpl is configured or rowHeaderField is updated
     */
    onRowsStoreUpdate: function(rowsStore, updatedRows) {
        console.log('onRowsStoreUpdate(%o, %s: %o)', rowsStore, updatedRows.length, updatedRows);
        debugger
        // this.refreshGrid();
        // TODO: ungroup data records
    },

    onDataStoreLoad: function(dataStore, records) {
        this.groupRecords(records);
    },

    onDataStoreAdd: function(dataStore, records) {
        this.groupRecords(records);
    },

    onDataStoreRemove: function(dataStore, records) {
        this.ungroupRecords(records);
        // TODO: purge removed data records from ungrouped
    },

    onDataStoreUpdate: function(dataStore, records) {
        this.regroupRecords([records], false);
        this.invalidateRecordGroups([records]);
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
            isExpand = !me.rowsExpanded[rowId];
            me.fireEventedAction(isExpand ? 'expand' : 'collapse', [me, rowId, el, ev], isExpand ? 'doExpand' : 'doCollapse', me);
        }
    },

    onColumnHeaderClick: function(columnId, el, ev) {
        this.fireEvent('columnheaderclick', this, columnId, el, ev);
    },

    onCellClick: function(rowId, columnId, el, ev) {
        this.fireEvent('cellclick', this, rowId, columnId, el, ev);
    },

    onDataScroll: function(ev, t) {
        this.rowHeadersScrollerEl.dom.scrollTop = t.scrollTop;
    },


    // component methods
    buildColumnRenderData: function(column) {
        return Ext.apply({
            id: column.getId(),
            record: column,
            data: column.getData(),
            columnHeaderTpl: this.getColumnHeaderTpl(),
            mappedRecords: []
        });
    },

    buildRowRenderData: function(row) {
        return Ext.apply({
            id: row.getId(),
            record: row,
            data: row.getData(),
            rowHeaderTpl: this.getRowHeaderTpl(),
            expandable: this.getExpandable(),
            rowColumns: {},
            mappedRecords: []
        });
    },

    paintColumns: function() {
        var me = this,
            columnsStore = me.getColumnsStore(),
            bufferedPaintColumns = me.bufferedPaintColumns;

        if (!me.rendered || !columnsStore|| !columnsStore.isLoaded()) {
            return;
        }

        if (!bufferedPaintColumns) {
            bufferedPaintColumns = me.bufferedPaintColumns = Ext.Function.createBuffered(me.fireEventedAction, 10, me, ['paintcolumns', [me], 'doPaintColumns', me]);
        }

        bufferedPaintColumns();
    },

    /**
     * @private
     * Scan through all columns and render any unrendered ranges
     */
    doPaintColumns: function() {
        console.info('doPaintColumns');

        var me = this,
            columnHeadersCt = me.columnHeadersCt,
            columnHeadersTpl = me.getTpl('columnHeadersTpl'),
            columns = me.columns,
            columnsLength = columns.length,
            columnIndex = 0, column,
            paintQueue = [], paintPosition,
            queryQueue = [], queryQueueLength, queryQueueIndex = 0, headerEl;

        // WRITE PHASE
        // intentionally loop once past the end of the array to flush paint queue
        for (; columnIndex <= columnsLength; columnIndex++) {
            column = columns[columnIndex];

            // flush paint queue if we find a rendered column or the end of the list
            if (!column || column.headerEl) {
                paintPosition = columnIndex - paintQueue.length;

                if (paintPosition != columnIndex) {
                    if (paintPosition > 0) {
                        columnHeadersTpl.insertAfter(columns[paintPosition - 1].headerEl, paintQueue);
                    } else {
                        columnHeadersTpl.insertFirst(columnHeadersCt, paintQueue);
                    }

                    // move painted columns to the query queue and reset the paint queue
                    Ext.Array.push(queryQueue, paintQueue);
                    paintQueue.length = 0;
                }

                continue;
            }

            paintQueue.push(column);
        }

        // READ PHASE
        for (queryQueueLength = queryQueue.length; queryQueueIndex < queryQueueLength; queryQueueIndex++) {
            column = queryQueue[queryQueueIndex];
            column.headerEl = headerEl = columnHeadersCt.down('.jarvus-aggregrid-colheader[data-column-id="'+column.id+'"]');
            column.linkEl = headerEl.down('.jarvus-aggregrid-header-link');
            column.textEl = headerEl.down('.jarvus-aggregrid-header-text');
        }
    },

    paintRows: function() {
        var me = this,
            rowsStore = me.getRowsStore(),
            bufferedPaintRows = me.bufferedPaintRows;

        if (!me.rendered || !rowsStore|| !rowsStore.isLoaded()) {
            return;
        }

        if (!bufferedPaintRows) {
            bufferedPaintRows = me.bufferedPaintRows = Ext.Function.createBuffered(me.fireEventedAction, 10, me, ['paintrows', [me], 'doPaintRows', me]);
        }

        bufferedPaintRows();
    },

    /**
     * @private
     * Scan through all rows and render any unrendered ranges
     */
    doPaintRows: function() {
        console.info('doPaintRows');

        var me = this,
            headerRowsCt = me.headerRowsCt,
            headerRowsTpl = me.getTpl('headerRowsTpl'),
            rows = me.rows,
            rowsLength = rows.length,
            rowIndex = 0, row,
            paintQueue = [], paintPosition,
            queryQueue = [], queryQueueLength, queryQueueIndex = 0, rowEl, expanderEl;

        // WRITE PHASE
        // intentionally loop once past the end of the array to flush paint queue
        for (; rowIndex <= rowsLength; rowIndex++) {
            row = rows[rowIndex];

            // flush paint queue if we find a rendered row or the end of the list
            if (!row || row.rowEl) {
                paintPosition = rowIndex - paintQueue.length;

                if (paintPosition != rowIndex) {
                    if (paintPosition > 0) {
                        headerRowsTpl.insertAfter(rows[paintPosition - 1].rowEl, paintQueue);
                    } else {
                        headerRowsTpl.insertFirst(headerRowsCt, paintQueue);
                    }

                    // move painted rows to the query queue and reset the paint queue
                    Ext.Array.push(queryQueue, paintQueue);
                    paintQueue.length = 0;
                }

                continue;
            }

            paintQueue.push(row);
        }

        // READ PHASE
        for (queryQueueLength = queryQueue.length; queryQueueIndex < queryQueueLength; queryQueueIndex++) {
            row = queryQueue[queryQueueIndex];
            row.rowEl = rowEl = headerRowsCt.down('.jarvus-aggregrid-row[data-row-id="'+row.id+'"]');
            row.textEl = rowEl.down('.jarvus-aggregrid-header-text');

            if (row.expandable) {
                row.expanderEl = expanderEl = headerRowsCt.down('.jarvus-aggregrid-expander[data-row-id="'+row.id+'"]');
                row.expanderBodyEl = expanderEl.down('.jarvus-aggregrid-expander-ct');
            }
        }
    },




    // refreshGrid: function() {
    //     var me = this,
    //         columnsStore = me.getColumnsStore(),
    //         rowsStore = me.getRowsStore(),
    //         bufferedRefreshGrid = me.bufferedRefreshGrid;

    //     if (
    //         !columnsStore || !rowsStore
    //         || !columnsStore.isLoaded() || !rowsStore.isLoaded()
    //     ) {
    //         return;
    //     }

    //     if (!bufferedRefreshGrid) {
    //         bufferedRefreshGrid = me.bufferedRefreshGrid = Ext.Function.createBuffered(me.fireEventedAction, 10, me, ['refreshgrid', [me], 'doRefreshGrid', me]);
    //     }

    //     bufferedRefreshGrid();
    // },

    /**
     * @private
     * Refresh the internal data structures for rows and columns
     */
    // doRefreshGrid: function(me) {
    //     console.info('%s.doRefreshGrid', this.getId());

    //     var me = this,
    //         groups = me.groups = {},

    //         rowsStore = me.getRowsStore(),
    //         rowsCount = rowsStore.getCount(),
    //         rowIndex = 0, row, rowId, rowGroups,

    //         columnsStore = me.getColumnsStore(),
    //         columnsCount = columnsStore.getCount(),
    //         columnIndex, column, columnId,

    //         dataStore = me.getDataStore();

    //     me.gridPainted = false;

    //     // initialize row x column groups map
    //     for (; rowIndex < rowsCount; rowIndex++) {
    //         row = rowsStore.getAt(rowIndex);
    //         rowId = row.getId();
    //         rowGroups = groups[rowId] = {};

    //         for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
    //             column = columnsStore.getAt(columnIndex);
    //             columnId = column.getId();

    //             rowGroups[columnId] = {
    //                 records: [],
    //                 row: row,
    //                 rowId: rowId,
    //                 column: column,
    //                 columnId: columnId
    //             };
    //         }
    //     }

    //     // reset grouped records by-id cache
    //     me.groupedRecords = {};
    //     me.ungroupedRecords = [];

    //     // group any initial data records
    //     if (dataStore && dataStore.getCount()) {
    //         me.groupRecords(dataStore.getRange());
    //     }

    //     // repaint grid
    //     me.repaintGrid();
    // },

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

        // var expandable = me.getExpandable(),
        //     groups = me.groups,
        //     el = me.el,

        //     columnsStore = me.getColumnsStore(),
        //     columnsCount = columnsStore.getCount(),
        //     rowsStore = me.getRowsStore(),
        //     rowsCount = rowsStore.getCount(),

        //     rowEls = me.rowEls = {},
        //     headerRowEls = me.headerRowEls = {},
        //     rowExpanderEls = me.rowExpanderEls = {},
        //     headerRowExpanderEls = me.headerRowExpanderEls = {},
        //     columnHeaderEls = me.columnHeaderEls = {},
        //     rowHeadersScrollerEl,
        //     dataCellsScrollerEl = me.dataCellsScrollerEl,
        //     rowHeadersCt, columnHeadersCt, dataCellsCt,

        //     rowIndex, row, rowId, rowEl, rowGroups,
        //     columnIndex, column, columnId,
        //     group;

        // // clear any existing scroll listener
        // if (dataCellsScrollerEl) {
        //     dataCellsScrollerEl.un('scroll', 'onDataScroll', me);
        // }

        // // WRITE PHASE: generate template data structure and execute against tpl
        // me.setData(me.buildTplData());

        // // reset expansion state
        // me.rowsExpanded = {};

        // // READ PHASE: query DOM for references to top-level containers
        // rowHeadersScrollerEl = me.rowHeadersScrollerEl = el.down('.jarvus-aggregrid-rowheaders-ct');
        // dataCellsScrollerEl = me.dataCellsScrollerEl = el.down('.jarvus-aggregrid-scroller');

        // rowHeadersCt = me.rowHeadersCt = rowHeadersScrollerEl.down('.jarvus-aggregrid-rowheaders-table tbody');
        // columnHeadersCt = me.columnHeadersCt = el.down('.jarvus-aggregrid-data-table thead');
        // dataCellsCt = me.dataCellsCt = dataCellsScrollerEl.down('.jarvus-aggregrid-data-table tbody');

        // // attach scroll listener
        // dataCellsScrollerEl.on('scroll', 'onDataScroll', me);

        // // READ phase: query DOM to collect references to key elements
        // for (rowIndex = 0; rowIndex < rowsCount; rowIndex++) {
        //     row = rowsStore.getAt(rowIndex);
        //     rowId = row.getId();
        //     rowGroups = groups[rowId];
        //     rowEl = rowEls[rowId] = dataCellsCt.down('.jarvus-aggregrid-row[data-row-id="'+rowId+'"]');

        //     headerRowEls[rowId] = rowHeadersCt.down('.jarvus-aggregrid-row[data-row-id="'+rowId+'"]');

        //     rowExpanderEls[rowId] = expandable && dataCellsCt.down('.jarvus-aggregrid-expander[data-row-id="'+rowId+'"] .jarvus-aggregrid-expander-ct');
        //     headerRowExpanderEls[rowId] = expandable && rowHeadersCt.down('.jarvus-aggregrid-expander[data-row-id="'+rowId+'"] .jarvus-aggregrid-expander-ct');

        //     for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
        //         column = columnsStore.getAt(columnIndex);
        //         columnId = column.getId();

        //         columnHeaderEls[columnId] = columnHeadersCt.down('.jarvus-aggregrid-colheader[data-column-id="'+columnId+'"]');

        //         group = rowGroups[columnId];
        //         group.cellEl = rowEl.down('.jarvus-aggregrid-cell[data-column-id="'+columnId+'"]');
        //         group.rendered = group.dirty = false;
        //     }
        // }

        // for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
        //     columnId = columnsStore.getAt(columnIndex).getId();
        //     columnHeaderEls[columnId] = columnHeadersCt.down('.jarvus-aggregrid-colheader[data-column-id="'+columnId+'"]');
        // }

        // // READ->WRITE phase: sync row heights
        // me.syncRowHeights();

        // me.gridPainted = true;

        // // repaint data
        // me.repaintCells();
    },

    buildTplData: function() {
        var me = this,
            columnsStore = me.getColumnsStore(),
            columnsCount = columnsStore.getCount(),
            rowsStore = me.getRowsStore(),
            rowsCount = rowsStore.getCount(),
            data = {
                headerRowsTpl: me.getTpl('headerRowsTpl'),
                rowsTpl: me.getTpl('rowsTpl')
            },
            columns = data.columns = [],
            rows = data.rows = [],
            i;

        for (i = 0; i < columnsCount; i++) {
            columns.push(me.buildColumnRenderData(columnsStore.getAt(i)));
        }

        for (i = 0; i < rowsCount; i++) {
            rows.push(me.buildRowRenderData(rowsStore.getAt(i), columns));
        }

        return data;
    },

    /**
     * @public
     * Synchronizes the heights of rows between the headers and data tables
     */
    syncRowHeights: function(rowIds) {
        var me = this,
            headerRowEls = me.headerRowEls,
            rowEls = me.rowEls,
            table1RowHeights = {},
            table2RowHeights = {},
            rowsLength, rowIndex, rowKey, maxHeight;

        rowIds = rowIds || Ext.Object.getKeys(me.groups);
        rowsLength = rowIds.length;

        Ext.batchLayouts(function() {
            // read all the row height in batch first for both tables
            for (rowIndex = 0; rowIndex < rowsLength; rowIndex++) {
                rowKey = rowIds[rowIndex];

                table1RowHeights[rowKey] = headerRowEls[rowKey].getHeight();
                table2RowHeights[rowKey] = rowEls[rowKey].getHeight();
            }

            // write all the max row heights
            for (rowIndex = 0; rowIndex < rowsLength; rowIndex++) {
                rowKey = rowIds[rowIndex];

                maxHeight = Math.max(table1RowHeights[rowKey], table2RowHeights[rowKey]);
                headerRowEls[rowKey].select('td, th').setHeight(maxHeight);
                rowEls[rowKey].select('td, th').setHeight(maxHeight);
            }
        });
    },

    groupRecords: function(records, repaint) {
        var me = this,
            groups = me.groups,
            groupedRecords = me.groupedRecords,
            ungroupedRecords = me.ungroupedRecords,

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
                ungroupedRecords.push(record);
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

        if (repaint !== false) {
            me.repaintCells();
        }
    },

    ungroupRecords: function(records, repaint) {
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

        if (repaint !== false) {
            me.repaintCells();
        }
    },

    regroupRecords: function(records, repaint) {
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
            ungroupedRecords = [],
            staleRecords = [];

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
                staleRecords.push(record);
                continue;
            }

            // check if record needs to be moved to a new group
            if (row === recordGroupData.row && column === recordGroupData.column) {
                continue;
            }

            // update row and column
            recordGroupData.row = row;
            recordGroupData.column = column;

            // get new group
            rowId = row.getId();
            columnId = column.getId();
            group = groups[rowId][columnId];

            // move record to new group
            Ext.Array.remove(previousGroup.records, recordGroupData);
            recordGroupData.previousGroup = previousGroup;
            recordGroupData.group = group;
            group.records.push(recordGroupData);

            // mark both groups dirty
            group.dirty = true;
            previousGroup.dirty = true;

            me.fireEvent('recordregrouped', me, recordGroupData, group, previousGroup);
        }

        if (ungroupedRecords.length) {
            me.groupRecords(ungroupedRecords, false);
        }

        if (staleRecords.length) {
            me.ungroupRecords(staleRecords, false);
        }

        if (repaint !== false) {
            me.repaintCells();
        }
    },

    invalidateRecordGroups: function(records, repaint) {
        var me = this,
            groupedRecords = me.groupedRecords,

            recordsLength = records.length,
            i = 0, recordGroupData;

        if (!groupedRecords) {
            return;
        }

        for (; i < recordsLength; i++) {
            recordGroupData = groupedRecords[records[i].getId()];

            if (recordGroupData) {
                recordGroupData.group.dirty = true;
            }
        }

        if (repaint !== false) {
            me.repaintCells();
        }
    },

    groupUngroupedRecords: function(repaint) {
        var me = this,
            ungroupedRecords = me.ungroupedRecords;

        if (!ungroupedRecords.length) {
            return;
        }

        me.ungroupedRecords = [];
        me.groupRecords(ungroupedRecords, repaint);
    },

    repaintCells: function(rowIds) {
        var me = this,
            bufferedRepaintCells = me.bufferedRepaintCells;

        if (!me.gridPainted) {
            return;
        }

        // skip buffering if this is a targetted repaint
        if (rowIds) {
            me.fireRepaintCells(rowIds);
            return;
        }

        if (!bufferedRepaintCells) {
            bufferedRepaintCells = me.bufferedRepaintCells = Ext.Function.createBuffered(me.fireRepaintCells, 10, me);
        }

        bufferedRepaintCells();
    },

    fireRepaintCells: function(rowIds) {
        var me = this;

        me.fireEventedAction('repaintcells', [me, rowIds], 'doRepaintCells', me);
    },

    doRepaintCells: function(me, rowIds) {
        console.info('%s.doRepaintCells(%o)', this.getId(), rowIds);

        var groups = me.groups,
            cellTpl = me.getCellTpl(),
            cellRenderer = me.getCellRenderer(),
            rowsLength, rowIndex = 0, rowId,
            columns, columnId, group, cellEl, rendered, dirty;

        if (!cellTpl && !cellRenderer) {
            return;
        }

        rowIds = rowIds || Ext.Object.getKeys(me.groups);
        rowsLength = rowIds.length;

        for (; rowIndex < rowsLength; rowIndex++) {
            rowId = rowIds[rowIndex];
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

        me.cellsPainted = true;
    },

    doExpand: function(me, rowId) {
        me.rowsExpanded[rowId] = true;
        me.syncExpanderHeight(rowId);
        me.rowEls[rowId].addCls('is-expanded');
        me.headerRowEls[rowId].addCls('is-expanded');
    },

    doCollapse: function(me, rowId) {
        me.rowsExpanded[rowId] = false;
        me.headerRowExpanderEls[rowId].setHeight(0);
        me.rowExpanderEls[rowId].setHeight(0);
        me.rowEls[rowId].removeCls('is-expanded');
        me.headerRowEls[rowId].removeCls('is-expanded');
    },

    syncExpanderHeight: function(rowId) {
        var me = this,
            rowHeaderExpanderEl = me.headerRowExpanderEls[rowId],
            rowExpanderEl = me.rowExpanderEls[rowId],

            rowHeaderExpanderHeight = rowHeaderExpanderEl.first().getHeight(),
            rowExpanderHeight = rowExpanderEl.first().getHeight(),
            maxHeight = Math.max(rowHeaderExpanderHeight, rowExpanderHeight);

        console.info('%s.syncExpanderHeight(%o) setting to max(%o, %o) = %o', this.getId(), rowId, rowHeaderExpanderHeight, rowExpanderHeight, maxHeight);

        rowHeaderExpanderEl.setHeight(maxHeight);
        rowExpanderEl.setHeight(maxHeight);
    }
});