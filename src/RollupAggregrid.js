/**
 * TODO:
 * - [ ] Apply refined lifecycle from Aggregrid
 * - [ ] Continuously update aggregate subRow groups after initial aggregation
 * - [ ] Continuously update subrow data cell renderings
 *
 * MAYBEDO:
 * - [ ] Move some of expander lifecycle up to base class
 */
Ext.define('Jarvus.aggregrid.RollupAggregrid', {
    extend: 'Jarvus.aggregrid.Aggregrid',
    xtype: 'jarvus-rollupaggregrid',


    config: {
        subRowsStore: null,
        subDataStore: null,

        parentRowMapper: 'parent_row_id',
        subRowMapper: 'sub_row_id',

        subRowHeaderField: 'title',
        subRowHeaderTpl: false,

        subCellTpl: '{[values.records && values.records.length || 0]}',
        subCellRenderer: false,

        expandable: true,
        expanderHeadersTpl: [
            '<table class="jarvus-aggregrid-expander-table">',
                '<tbody>',
                    '<tpl for="subRows">',
                        '<tr class="jarvus-aggregrid-subrow" data-subrow-id="{id}">',
                            '<th class="jarvus-aggregrid-rowheader">',
                                '<span class="jarvus-aggregrid-header-text">',
                                    '{% values.rowHeaderTpl.applyOut(values, out, parent) %}',
                                '</span>',
                            '</th>',
                        '</tr>',
                    '</tpl>',
                '</tbody>',
            '</table>'
        ],
        expanderBodyTpl: [
            '<table class="jarvus-aggregrid-expander-table">',
                '<tbody>',
                    '<tpl for="subRows">',
                        '<tr class="jarvus-aggregrid-subrow" data-subrow-id="{id}">',
                            '<tpl for="columns">',
                                '<td class="jarvus-aggregrid-cell {cls}" data-column-id="{id}">{text}</td>',
                            '</tpl>',
                        '</tr>',
                    '</tpl>',
                '</tbody>',
            '</table>'
        ]
    },


    // config handlers
    applySubRowsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    // updateSubRowsStore: function(store, oldStore) {
    //     var me = this;

    //     if (oldStore) {
    //         oldStore.un('datachanged', 'refresh', me);
    //     }

    //     if (store) {
    //         me.refresh();
    //         store.on('datachanged', 'refresh', me);
    //     }
    // },

    applySubDataStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    // updateSubDataStore: function(store, oldStore) {
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

    applySubRowHeaderTpl: function(tpl) {
        if (!tpl) {
            tpl = new Ext.XTemplate(
                '{[typeof values === "string" ? values : values["' + this.getSubRowHeaderField() + '"]]}'
            );
        } else if (!tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },

    applyParentRowMapper: function(mapper) {
        if (!Ext.isString(mapper)) {
            return mapper;
        }

        return function(subRowRecord, rowsStore) {
            return rowsStore.getById(subRowRecord.get(mapper));
        };
    },

    applySubRowMapper: function(mapper) {
        if (!Ext.isString(mapper)) {
            return mapper;
        }

        return function(dataRecord, subRowsStore) {
            return subRowsStore.getById(dataRecord.get(mapper));
        };
    },

    applySubCellTpl: function(tpl) {
        if (tpl && !tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },

    applyExpanderHeadersTpl: function(tpl) {
        if (tpl && !tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },

    applyExpanderBodyTpl: function(tpl) {
        if (tpl && !tpl.isTemplate) {
            tpl = new Ext.XTemplate(tpl);
        }

        return tpl;
    },


    // event handlers


    // component methods
    doRefreshGrid: function(me) {
        var rollupRows = me.rollupRows = {},
            rowsStore = me.getRowsStore(),
            rowsCount = rowsStore.getCount(),
            rowIndex = 0, row, rowId;

        me.callParent(arguments);

        // initialize subrows data structure
        for (; rowIndex < rowsCount; rowIndex++) {
            row = rowsStore.getAt(rowIndex);
            rowId = row.getId();

            rollupRows[rowId] = {
                row: row,
                rowId: rowId,
                subRows: [],
                groups: {}
            };
        }
    },

    doExpand: function(me, rowId) {
        console.info('%s.doExpand(%o)', this.getId(), rowId);

        var rollupRow = me.rollupRows[rowId],
            expanderTplData = me.buildExpanderTplData(rowId);

        if (!rollupRow.cellsRendered) {
            rollupRow.headersEl = me.getExpanderHeadersTpl().overwrite(me.rowHeaderExpanderEls[rowId], expanderTplData, true);
            rollupRow.bodyEl = me.getExpanderBodyTpl().overwrite(me.rowExpanderEls[rowId], expanderTplData, true);

            me.afterExpanderRefresh(rowId);

            me.aggregateSubRows(rowId);

            me.fireEventedAction('rendersubcells', [me, rowId], 'doRenderSubCells', me);
        }

        me.callParent(arguments);
    },

    buildExpanderTplData: function(rowId) {
        var me = this,
            rowHeaderTpl = me.getSubRowHeaderTpl() || me.getRowHeaderTpl(),

            columnsStore = me.getColumnsStore(),
            columnsCount = columnsStore.getCount(),
            columnIndex = 0,

            subRows = me.getSubRows(rowId),
            subRowsCount = subRows.length,
            subRowIndex = 0,

            data = {},
            columnsData = data.columns = [],
            subRowsData = data.subRows = [];

        // generate columns and rows render data
        for (; columnIndex < columnsCount; columnIndex++) {
            columnsData.push(columnsStore.getAt(columnIndex).getData());
        }

        for (; subRowIndex < subRowsCount; subRowIndex++) {
            subRowsData.push(Ext.apply({
                rowHeaderTpl: rowHeaderTpl,
                columns: columnsData
            }, subRows[subRowIndex].getData()));
        }

        return data;
    },

    groupSubRows: function() {
        if (this.subRowParents) {
            return;
        }

        var me = this,
            rollupRows = me.rollupRows,
            subRowParents = me.subRowParents = {},

            rowsStore = me.getRowsStore(),
            subRowsStore = me.getSubRowsStore(),
            parentRowMapper = me.getParentRowMapper(),
            subRowsCount = subRowsStore.getCount(),
            subRowIndex = 0, subRow, parentRow;

        for (; subRowIndex < subRowsCount; subRowIndex++) {
            subRow = subRowsStore.getAt(subRowIndex);
            parentRow = parentRowMapper(subRow, rowsStore);

            subRowParents[subRow.getId()] = parentRow;
            rollupRows[parentRow.getId()].subRows.push(subRow);
        }
    },

    getSubRows: function(rowId) {
        this.groupSubRows();
        return this.rollupRows[rowId].subRows;
    },

    getParentRow: function(subRowId) {
        this.groupSubRows();
        return this.subRowParents[subRowId];
    },

    afterExpanderRefresh: function(rowId) {
        console.info('%s.afterExpanderRefresh(%o)', this.getId(), rowId);

        var me = this,
            rollupRow = me.rollupRows[rowId],
            headersEl = rollupRow.headersEl,
            bodyEl = rollupRow.bodyEl,
            groups = rollupRow.groups,

            subRowEls = rollupRow.subRowEls = {},
            subRowHeaderEls = rollupRow.subRowHeaderEls = {},

            subRows = rollupRow.subRows,
            subRowsCount = subRows.length,
            subRowIndex = 0, subRow, subRowId, subRowGroups, subRowEl,

            columnsStore = me.getColumnsStore(),
            columnsCount = columnsStore.getCount(),
            columnIndex, column, columnId,
            group;

        // READ phase: query dom to collect references to key elements
        for (; subRowIndex < subRowsCount; subRowIndex++) {
            subRow = subRows[subRowIndex];
            subRowId = subRow.getId();
            subRowGroups = groups[subRowId] || (groups[subRowId] = {});

            subRowHeaderEls[subRowId] = headersEl.down('.jarvus-aggregrid-subrow[data-subrow-id="'+subRowId+'"]');
            subRowEl = subRowEls[subRowId] = bodyEl.down('.jarvus-aggregrid-subrow[data-subrow-id="'+subRowId+'"]');

            for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
                column = columnsStore.getAt(columnIndex);
                columnId = column.getId();

                group = subRowGroups[columnId] || (subRowGroups[columnId] = {});
                group.cellEl = subRowEl.down('.jarvus-aggregrid-cell[data-column-id="'+columnId+'"]');
                group.row = subRow;
                group.subRowId = subRowId;
                group.column = column;
                group.columnId = columnId;
            }
        }

        // READ->WRITE phase: sync row heights
        me.syncSubRowHeights(rowId);

        me.fireEvent('afterexpanderrefresh', me, rowId);
    },

    /**
     * @public
     * Synchronizes the heights of rows between the headers and data tables
     */
    syncSubRowHeights: function(rowId) {
        var me = this,
            rollupRow = me.rollupRows[rowId],
            subRowEls = rollupRow.subRowEls,
            subRowHeaderEls = rollupRow.subRowHeaderEls,
            table1RowHeights = {},
            table2RowHeights = {},
            rowKey, maxHeight;

        Ext.batchLayouts(function() {
            // read all the row height in batch first for both tables
            for (rowKey in subRowHeaderEls) { // eslint-disable-line guard-for-in
                table1RowHeights[rowKey] = subRowHeaderEls[rowKey].getHeight();
                table2RowHeights[rowKey] = subRowEls[rowKey].getHeight();
            }

            // write all the max row heights
            for (rowKey in subRowHeaderEls) { // eslint-disable-line guard-for-in
                maxHeight = Math.max(table1RowHeights[rowKey], table2RowHeights[rowKey]);
                subRowHeaderEls[rowKey].select('td, th').setHeight(maxHeight);
                subRowEls[rowKey].select('td, th').setHeight(maxHeight);
            }
        });
    },

    aggregateSubRows: function(rowId) {
        var me = this,
            store = me.getSubDataStore();

        if (!store || !store.isLoaded()) {
            return;
        }

        console.info('%s.aggregateSubRows(%o)', this.getId(), rowId);

        me.fireEventedAction('aggregatesubrows', [me, rowId], 'doAggregateSubRows', me);
    },

    doAggregateSubRows: function(me) {

        // guard against additional runs here rather than in aggregateSubRows(), child classes
        // may provide different implementations that use the rowId parameter to load rows individually
        if (me.groupedSubRecords) {
            return;
        }

        var rollupRows = me.rollupRows,
            groupedSubRecords = me.groupedSubRecords = {},
            subDataStore = me.getSubDataStore(),
            subRowsStore = me.getSubRowsStore(),
            columnsStore = me.getColumnsStore(),
            subRowMapper = me.getSubRowMapper(),
            columnMapper = me.getColumnMapper(),
            subRecordsCount = subDataStore.getCount(),
            subRecordIndex = 0, subRecord, subRecordId, parentRollupRow, subRecordGroupData,
            subRow, subRowId, parentRow, column, columnId, group, groupRecords;

        for (; subRecordIndex < subRecordsCount; subRecordIndex++) {
            subRecord = subDataStore.getAt(subRecordIndex);
            subRecordId = subRecord.getId();

            // get target row and column for this record
            subRow = subRowMapper(subRecord, subRowsStore);
            parentRow = subRow && me.getParentRow(subRow.getId());
            column = columnMapper(subRecord, columnsStore);

            if (!subRow || !parentRow || !column) {
                Ext.Logger.warn('Data record ' + subRecordId + ' not matched to ' + (!subRow ? 'subRow' : !parentRow ? 'parentRow' : 'column')); // eslint-disable-line no-negated-condition, no-nested-ternary
                continue;
            }

            // create metadata container for record indexed by its id
            subRecordGroupData = groupedSubRecords[subRecordId] = {
                record: subRecord,
                subRow: subRow,
                parentRow: parentRow,
                column: column
            };

            // push record to records array for group at [rowId][columnId]
            parentRollupRow = rollupRows[parentRow.getId()];
            group = parentRollupRow.groups;

            subRowId = subRow.getId();
            group = group[subRowId] || (group[subRowId] = {});

            columnId = column.getId();
            group = group[columnId] || (group[columnId] = {});
            groupRecords = group.records || (group.records = []);

            subRecordGroupData.group = group;
            groupRecords.push(subRecordGroupData);
        }
    },

    doRenderSubCells: function(me, rowId) {
        console.info('%s.doRenderSubCells(%o)', this.getId(), rowId);

        var rollupRow = me.rollupRows[rowId],
            groups = rollupRow.groups,
            subCellTpl = me.getSubCellTpl(),
            subCellRenderer = me.getSubCellRenderer(),
            subRowId, columns, columnId, group, cellEl;

        if (!subCellTpl && !subCellRenderer) {
            return;
        }

        rollupRow.cellsRendered = true;

        for (subRowId in groups) { // eslint-disable-line guard-for-in
            columns = groups[subRowId];

            for (columnId in columns) { // eslint-disable-line guard-for-in
                group = columns[columnId];
                cellEl = group.cellEl;

                if (subCellTpl) {
                    subCellTpl.overwrite(cellEl, group);
                }

                if (subCellRenderer) {
                    subCellRenderer.call(this, group, cellEl);
                }
            }
        }
    }
});