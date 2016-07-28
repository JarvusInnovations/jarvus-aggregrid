/**
 * TODO:
 * - [X] Apply refined lifecycle from Aggregrid
 *      - [X] repaintSubGrid -> repaintSubCells
 *      - [X] new rendering flow
 * - [ ] Continuously update aggregate subRow groups after initial aggregation
 *      - [X] Eliminate aggregate function in favor of groupSubRecords()
 *      - [ ] Implement regroupSubRecords and ungroupSubRecords, wire to store events
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

    updateSubDataStore: function(store, oldStore) {
        var me = this,
            listeners = {
                scope: me,
                load: 'onSubDataStoreLoad',
                add: 'onSubDataStoreAdd',
                remove: 'onSubDataStoreRemove',
                update: 'onSubDataStoreUpdate'
            };

        if (oldStore) {
            oldStore.un(listeners);
        }

        if (store) {
            store.on(listeners);
        }
    },

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
    onSubDataStoreLoad: function(subDataStore, subRecords) {
        this.groupSubRecords(subRecords);
    },

    onSubDataStoreAdd: function(subDataStore, subRecords) {
        this.groupSubRecords(subRecords);
    },

    onSubDataStoreRemove: function(subDataStore, subRecords) {
        this.ungroupSubRecords(subRecords);
    },

    onSubDataStoreUpdate: function(subDataStore, subRecords) {
        this.regroupSubRecords([subRecords], false);
        this.invalidateSubRecordGroups([subRecords]);
    },


    // Aggregrid lifecycle overrides
    doRefreshGrid: function(me) {
        var rollupRows = me.rollupRows = {},
            rowsStore = me.getRowsStore(),
            rowsCount = rowsStore.getCount(),
            rowIndex = 0, row, rowId,

            subDataStore = me.getSubDataStore();

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

        // reset grouped records by-id cache
        me.groupedSubRecords = {};

        // group any initial data records
        if (subDataStore && subDataStore.getCount()) {
            me.groupSubRecords(subDataStore.getRange());
        }

    },

    doExpand: function(me, rowId) {
        console.info('%s.doExpand(%o)', me.getId(), rowId);
        me.repaintSubGrid(rowId);
        me.callParent(arguments);
    },

    // RollupAggregrid methods
    repaintSubGrid: function(rowId) {
        var me = this,
            rollupRow = (me.rollupRows||{})[rowId];

        if (!rollupRow || !rollupRow.groups) {
            return;
        }

        me.fireEventedAction('repaintsubgrid', [me, rowId], 'doRepaintSubGrid', me);
    },

    doRepaintSubGrid: function(me, rowId) {
        var rollupRow = me.rollupRows[rowId],
            groups = rollupRow.groups,
            expanderTplData = me.buildExpanderTplData(rowId),

            subRowEls = rollupRow.subRowEls = {},
            subRowHeaderEls = rollupRow.subRowHeaderEls = {},
            headersEl, bodyEl,

            subRows = rollupRow.subRows,
            subRowsCount = subRows.length,
            subRowIndex = 0, subRow, subRowId, subRowGroups, subRowEl,

            columnsStore = me.getColumnsStore(),
            columnsCount = columnsStore.getCount(),
            columnIndex, column, columnId,
            group;

        // render templates against generated template data
        headersEl = rollupRow.headersEl = me.getExpanderHeadersTpl().overwrite(me.rowHeaderExpanderEls[rowId], expanderTplData, true);
        bodyEl = rollupRow.bodyEl = me.getExpanderBodyTpl().overwrite(me.rowExpanderEls[rowId], expanderTplData, true);

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

        rollupRow.gridPainted = true;

        // recompile and repaint data
        me.repaintSubCells(rowId);
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

    // TODO: do this on on ongoing basis in response to rowsStore events
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

    groupSubRecords: function(subRecords, repaint) {
        var me = this,
            rollupRows = me.rollupRows,
            groupedSubRecords = me.groupedSubRecords,

            subRowsStore = me.getSubRowsStore(),
            subRowMapper = me.getSubRowMapper(),
            columnsStore = me.getColumnsStore(),
            columnMapper = me.getColumnMapper(),

            subRecordsCount = subRecords.length,
            subRecordIndex = 0, subRecord, subRecordId, parentRollupRow, subRecordGroupData,
            subRow, subRowId, parentRow, parentRowId, column, columnId, group, groupRecords,
            repaintRows = {};

        if (!groupedSubRecords) {
            return;
        }

        for (; subRecordIndex < subRecordsCount; subRecordIndex++) {
            subRecord = subRecords[subRecordIndex];
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
            parentRowId = parentRow.getId();
            parentRollupRow = rollupRows[parentRowId];
            group = parentRollupRow.groups;

            subRowId = subRow.getId();
            group = group[subRowId] || (group[subRowId] = {});

            columnId = column.getId();
            group = group[columnId] || (group[columnId] = {});
            groupRecords = group.records || (group.records = []);

            subRecordGroupData.group = group;
            groupRecords.push(subRecordGroupData);

            // mark group dirty
            group.dirty = true;

            // mark parent row for repaint
            repaintRows[parentRowId] = true;

            me.fireEvent('subrecordgrouped', me, subRecordGroupData, group);
        }

        if (repaint !== false) {
            for (parentRowId in repaintRows) {
                if (rollupRows[parentRowId].cellsPainted) {
                    me.repaintSubCells(parentRowId);
                }
            }
        }
    },

    ungroupSubRecords: function(subRecords, repaint) {
        var me = this,
            rollupRows = me.rollupRows,
            groupedSubRecords = me.groupedSubRecords,
            subRecordsLength = subRecords.length,
            i = 0, subRecord, subRecordId, subRecordGroupData, group,
            repaintRows = {}, parentRowId;

        if (!groupedSubRecords) {
            return;
        }

        for (; i < subRecordsLength; i++) {
            subRecord = subRecords[i];
            subRecordId = subRecord.getId();
            subRecordGroupData = groupedSubRecords[subRecordId];

            if (!subRecordGroupData) {
                continue; // this record was not rendered into a group
            }

            group = subRecordGroupData.group;

            // remove from group
            Ext.Array.remove(subRecordGroupData.group.records, subRecordGroupData);
            delete subRecordGroupData.group;

            // remove metadata
            delete groupedSubRecords[subRecordId];

            // mark group dirty
            group.dirty = true;

            // mark parent row for repaint
            repaintRows[subRecordGroupData.parentRow.getId()] = true;

            me.fireEvent('subrecordungrouped', me, subRecordGroupData, group);
        }

        if (repaint !== false) {
            for (parentRowId in repaintRows) {
                if (rollupRows[parentRowId].cellsPainted) {
                    me.repaintSubCells(parentRowId);
                }
            }
        }
    },

    regroupSubRecords: function(records, repaint) {
        // TODO: keep track of what rollupRows have been dirtied and repaint the ones with .cellsPainted unless repaint === false
    },

    invalidateSubRecordGroups: function(subRecords, repaint) {
        // var me = this,
        //     groupedRecords = me.groupedRecords,

        //     recordsLength = records.length,
        //     i = 0, recordGroupData;

        // if (!groupedRecords) {
        //     return;
        // }

        // for (; i < recordsLength; i++) {
        //     recordGroupData = groupedRecords[records[i].getId()];

        //     if (recordGroupData) {
        //         recordGroupData.group.dirty = true;
        //     }
        // }

        // if (repaint !== false) {
        //     me.repaintCells();
        // }
    },

    repaintSubCells: function(rowId) {
        var me = this,
            bufferedRepaintSubCells = me.bufferedRepaintSubCells || (me.bufferedRepaintSubCells = {}),
            repaint = bufferedRepaintSubCells[rowId];

        if (!repaint) {
            repaint = bufferedRepaintSubCells[rowId] = Ext.Function.createBuffered(me.fireEventedAction, 10, me, ['repaintsubcells', [me, rowId], 'doRepaintSubCells', me]);
        }

        repaint();
    },

    doRepaintSubCells: function(me, rowId) {
        console.info('%s.doRepaintSubCells(%o)', this.getId(), rowId);

        var rollupRow = me.rollupRows[rowId],
            groups = rollupRow.groups,
            subCellTpl = me.getSubCellTpl(),
            subCellRenderer = me.getSubCellRenderer(),
            subRowId, columns, columnId, group, cellEl, rendered, dirty;

        if (!subCellTpl && !subCellRenderer) {
            return;
        }

        rollupRow.cellsPainted = true;

        for (subRowId in groups) { // eslint-disable-line guard-for-in
            columns = groups[subRowId];

            for (columnId in columns) { // eslint-disable-line guard-for-in
                group = columns[columnId];
                cellEl = group.cellEl;
                rendered = group.rendered;
                dirty = group.dirty;

                // apply cellTpl if this is the first render OR there's no cellRenderer and the group is dirty
                if (!rendered || (!subCellRenderer && dirty)) {
                    group.tplNode = subCellTpl && subCellTpl.overwrite(cellEl, group);
                }

                if (!rendered || dirty) {
                    group.rendered = subCellRenderer && subCellRenderer.call(me, group, cellEl, rendered || false) || true;
                    group.dirty = false;
                }
            }
        }
    }
});