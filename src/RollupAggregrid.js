/**
 * TODO:
 * - [X] Apply refined lifecycle from Aggregrid
 *      - [X] repaintSubGrid -> repaintSubCells
 *      - [X] new rendering flow
 * - [X] Continuously update aggregate subRow groups after initial aggregation
 *      - [X] Eliminate aggregate function in favor of groupSubRecords()
 *      - [X] Implement regroupSubRecords and ungroupSubRecords, wire to store events
 * - [X] Continuously update subrow data cell renderings
 * - [X] Add new rows incrementally instead of redrawing
 *      - [X] Eliminate groupSubRows, maintain metadata continously in response to subRowsStore events
 * - [X] Track ungrouped subrecords and re-process on subrow add
 * - [X] Continuously remove rows
 * - [X] Handle subrows getting loaded before rows+columns->doRowRefresh
 * - [ ] Should ungrouped records/subsubrecords get added to ungroupedRecords array?
 *       - Usually those are called when the records are being removed
 *       - But they might also be getting ungrouped because their parent is being removed and we want to keep them, ready for regrouping.
 *       - maybe ungroup* should just be for deleting, and another method can handle re-staging them..is this what onRowRemove does?
 *       - maybe ungroup* should always add to ungrouped, and then remove handles should additionally purge the ungrouped arrays, as they might already contain the removed records
 * - [ ] Continuously update rows
 * - [ ] Respect subrow order from store
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

        expandable: true
    },


    expanderHeadersTpl: [
        '<table class="jarvus-aggregrid-expander-table">',
            '<tbody>{% values.headerSubRowsTpl.applyOut(values.subRows, out) %}</tbody>',
        '</table>'
    ],

    expanderBodyTpl: [
        '<table class="jarvus-aggregrid-expander-table">',
            '<tbody>{% values.subRowsTpl.applyOut(values.subRows, out) %}</tbody>',
        '</table>'
    ],

    headerSubRowsTpl: [
        '<tpl for=".">',
            '<tr class="jarvus-aggregrid-subrow" data-subrow-id="{subRowId}">',
                '<th class="jarvus-aggregrid-rowheader">',
                    '<span class="jarvus-aggregrid-header-text">',
                        '{% values.rowHeaderTpl.applyOut(values, out, parent) %}',
                    '</span>',
                '</th>',
            '</tr>',
        '</tpl>'
    ],

    subRowsTpl: [
        '<tpl for=".">',
            '<tr class="jarvus-aggregrid-subrow" data-subrow-id="{subRowId}">',
                '<tpl for="columns">',
                    '<td class="jarvus-aggregrid-cell" data-column-id="{columnId}"></td>',
                '</tpl>',
            '</tr>',
        '</tpl>'
    ],


    // component lifecycle overrides
    constructor: function() {
        var me = this;

        // initialize internal data structures before configuration gets initialized
        me.subRows = {};
        me.unmappedSubRows = [];

        me.subRecords = {};
        me.ungroupedSubRecords = [];

        // continue with component construction and configuration initialization
        me.callParent(arguments);
    },


    // config handlers
    applySubRowsStore: function(store) {
        return Ext.StoreMgr.lookup(store);
    },

    updateSubRowsStore: function(store, oldStore) {
        var me = this,
            listeners = {
                scope: me,
                load: 'onSubRowsStoreLoad',
                add: 'onSubRowsStoreAdd',
                remove: 'onSubRowsStoreRemove',
                update: 'onSubRowsStoreUpdate'
            };

        if (oldStore) {
            oldStore.un(listeners);
        }

        if (store) {
            store.on(listeners);
        }
    },

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
                '{[typeof values === "string" ? values : values.data["' + this.getSubRowHeaderField() + '"]]}'
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


    // event handlers

    /**
     * @override
     * Overrides Aggregrid's handler for row records being added
     *
     * When new main/parent/rollup rows are added, RollupAggregrid must:
     * - Initialize metadata structures for parent(rollup) row
     * - Scan through unmappedSubRows to find any that can now be mapped
     */
    onRowsStoreAdd: function(rowsStore, rows) {
        var me = this,
            rollupRows = me.rollupRows,
            rowsLength = rows.length,
            rowIndex = 0, row, rowId;

        me.callParent(arguments);

        for (; rowIndex < rowsLength; rowIndex++) {
            row = rows[rowIndex];
            rowId = row.getId();

            rollupRows[rowId] = {
                row: row,
                rowId: rowId,
                subRows: [],
                groups: {}
            };
        }

        // remap subRows
        me.mapUnmappedSubRows();
    },

    /**
     * @override
     * Overrides Aggregrid's handler for row records being removed
     *
     * When new main/parent/rollup rows are removed, RollupAggregrid must:
     * - Destroy metadata structures for parent(rollup) row
     * - Move any mapped subrows to unmapped
     */
    onRowsStoreRemove: function(rowsStore, rows) {
        var me = this,
            rollupRows = me.rollupRows,
            subRowParents = me.subRowParents,
            rowsLength = rows.length,
            rowIndex = 0, row, rowId,
            groups, subRowId, rollupRow,
            columns, columnId, group, groupRecords,
            staleRecords = [];

        me.callParent(arguments);

        for (; rowIndex < rowsLength; rowIndex++) {
            row = rows[rowIndex];
            rowId = row.getId();
            rollupRow = rollupRows[rowId];
            groups = rollupRow.groups;

            for (subRowId in groups) { // eslint-disable-line guard-for-in
                columns = groups[subRowId];

                delete subRowParents[subRowId];

                for (columnId in columns) { // eslint-disable-line guard-for-in
                    group = columns[columnId];
                    groupRecords = group.records;

                    if (groupRecords) {
                        Ext.Array.push(staleRecords, Ext.Array.pluck(groupRecords, 'record'));
                    }
                }
            }

            delete rollupRows[rowId];
        }

        me.ungroupSubRecords(staleRecords, false);
    },

    /**
     * @override
     * Overrides Aggregrid's handler for row records being updated
     *
     * When new main/parent/rollup rows are updated, RollupAggregrid must:
     * - Re-test any mapped subrows and move to unmappedSubRows if they no longer match
     * - Scan through unmappedSubRows to find any that can now be mapped
     */
    onRowsStoreUpdate: function(rowsStore, rows) {
        this.callParent(arguments);
    },

    /**
     * When new subRows are loaded, do the same as onSubRowsStoreAdd
     */
    onSubRowsStoreLoad: function(subRowsStore, subRows) {
        this.groupUngroupedSubRecords(false); // no need to repaint, these subRows aren't mapped yet
        this.mapSubRows(subRows);
    },

    /**
     * When new subRows are added:
     * - Scan through ungroupedSubRecords to find any that can now be grouped to the new subRows
     * - Attempt to map each new subRow to a parent row or add to unmappedSubRows
     */
    onSubRowsStoreAdd: function(subRowsStore, subRows) {
        this.groupUngroupedSubRecords(false); // no need to repaint, these subRows aren't mapped yet
        this.mapSubRows(subRows);
    },

    /**
     * When subRows are removed:
     * - Unmap removed subRows from parent(rollup) rows
     * - Purge removed subRows from unmappedSubRows
     * - Ungroup all subRecords grouped into the removed subRows
     */
    onSubRowsStoreRemove: function(subRowsStore, subRows) {
        this.unmapSubRows(subRows);
    },

    /**
     * When subRows are updated:
     * - Scan through all subRecords grouped to updated subRows and regroup them
     * - Scan through ungroupedSubRecords to find any that can now be grouped to the updated subRows
     * - Remap each updated subRow or move to unmappedSubRows
     * - Update subrow header content if subRowHeaderTpl is configured or subRowHeaderField is updated
     */
    onSubRowsStoreUpdate: function(subRowsStore, subRows) {
        this.remapSubRows(subRows);
    },

    /**
     * When subRecords are loaded, do the same as onSubDataStoreAdd
     */
    onSubDataStoreLoad: function(subDataStore, subRecords) {
        this.groupSubRecords(subRecords);
    },

    /**
     * When subRecords are added:
     * - Group new subRecords to a subRow or add to ungroupedSubRecords
     * - Repaint all subRows impacted by new grouping
     */
    onSubDataStoreAdd: function(subDataStore, subRecords) {
        this.groupSubRecords(subRecords);
    },

    /**
     * When subRecords are removed:
     * - Ungroup from subRows
     * - Purge removed subRecords from ungroupedSubRecords
     * - Repaint all subRows impacted by new grouping
     */
    onSubDataStoreRemove: function(subDataStore, subRecords) {
        this.ungroupSubRecords(subRecords);
    },

    /**
     * When subRecords are updated:
     * - Regroup all updated subRecords or move to ungroupedSubRecords
     * - Repaint all subRows impacted by new grouping or containing any of the updated subRecords
     */
    onSubDataStoreUpdate: function(subDataStore, subRecords) {
        this.regroupSubRecords([subRecords], false);
        this.invalidateSubRecordGroups([subRecords]);
    },

    // override of parent method
    onClick: function(ev, target) {
        var me = this,
            containerEl = me.el;

        if (target = ev.getTarget('.jarvus-aggregrid-subrow .jarvus-aggregrid-rowheader', containerEl, true)) { // eslint-disable-line no-cond-assign
            return me.onSubRowHeaderClick(
                parseInt(target.up('.jarvus-aggregrid-subrow').getAttribute('data-subrow-id'), 10),
                target,
                ev
            );
        }

        if (target = ev.getTarget('.jarvus-aggregrid-subrow .jarvus-aggregrid-cell', containerEl, true)) { // eslint-disable-line no-cond-assign
            return me.onSubCellClick(
                parseInt(target.up('.jarvus-aggregrid-subrow').getAttribute('data-subrow-id'), 10),
                parseInt(target.getAttribute('data-column-id'), 10),
                target,
                ev
            );
        }

        return me.callParent(arguments);
    },

    onSubRowHeaderClick: function(subRowId, el, ev) {
        this.fireEvent('subrowheaderclick', this, subRowId, el, ev);
    },

    onSubCellClick: function(subRowId, columnId, el, ev) {
        this.fireEvent('subcellclick', this, subRowId, columnId, el, ev);
    },

    // Aggregrid lifecycle overrides
    doRefreshGrid: function(me) {
        var rollupRows = me.rollupRows = {},
            rowsStore = me.getRowsStore(),
            rowsCount = rowsStore.getCount(),
            rowIndex = 0, row, rowId,

            subRowsStore = me.getSubRowsStore(),
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

        // reset subRow parents cache
        me.subRowParents = {};
        me.unmappedSubRows = [];

        // reset grouped records by-id cache
        me.groupedSubRecords = {};
        me.ungroupedSubRecords = [];

        // group any initial subrows
        if (subRowsStore && subRowsStore.getCount()) {
            me.mapSubRows(subRowsStore.getRange());
        }

        // group any initial data records
        if (subDataStore && subDataStore.getCount()) {
            me.groupSubRecords(subDataStore.getRange(), false);
        }
    },

    doExpand: function(me, rowId) {
        console.info('%s.doExpand(%o)', me.getId(), rowId);

        var rollupRow = me.rollupRows[rowId];

        if (rollupRow && !rollupRow.gridPainted) {
            me.repaintSubGrid(rowId);
        }

        me.callParent(arguments);
    },

    // RollupAggregrid methods
    repaintSubGrid: function(rowId) {
        var me = this,
            rollupRow = me.rollupRows[rowId];

        if (!rollupRow || !rollupRow.groups) {
            return;
        }

        me.fireEventedAction('repaintsubgrid', [me, rowId], 'doRepaintSubGrid', me);
    },

    doRepaintSubGrid: function(me, rowId) {
        console.info('%s.doRepaintSubGrid(%o)', this.getId(), rowId);

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

        // WRITE phase: render templates against generated template data
        headersEl = rollupRow.headersEl = me.getTpl('expanderHeadersTpl').overwrite(me.headerRowExpanderEls[rowId], expanderTplData, true).down('tbody');
        bodyEl = rollupRow.bodyEl = me.getTpl('expanderBodyTpl').overwrite(me.rowExpanderEls[rowId], expanderTplData, true).down('tbody');

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
                group.rendered = group.dirty = false;
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
            rollupRows = me.rollupRows,

            columnsStore = me.getColumnsStore(),
            columnsCount = columnsStore.getCount(),
            columnIndex = 0,

            subRows = rollupRows[rowId].subRows,
            subRowsCount = subRows.length,
            subRowIndex = 0,

            data = {
                headerSubRowsTpl: me.getTpl('headerSubRowsTpl'),
                subRowsTpl: me.getTpl('subRowsTpl')
            },
            columnsData = data.columns = [],
            subRowsData = data.subRows = [];

        // generate columns and rows render data
        for (; columnIndex < columnsCount; columnIndex++) {
            columnsData.push(me.buildColumnTplData(columnsStore.getAt(columnIndex)));
        }

        for (; subRowIndex < subRowsCount; subRowIndex++) {
            subRowsData.push(me.buildSubRowTplData(subRows[subRowIndex], columnsData));
        }

        return data;
    },

    buildSubRowTplData: function(subRow, columns) {
        return Ext.apply({
            rowHeaderTpl: this.getSubRowHeaderTpl() || this.getRowHeaderTpl(),
            columns: columns,
            subRowId: subRow.getId(),
            data: subRow.getData()
        });
    },

    mapSubRows: function(subRows) {
        var me = this,
            rollupRows = me.rollupRows,
            subRowParents = me.subRowParents,
            unmappedSubRows = me.unmappedSubRows,

            rowsStore = me.getRowsStore(),
            parentRowMapper = me.getParentRowMapper(),
            subRowsLength = subRows.length,
            subRowIndex = 0, subRow, subRowId, parentRow, parentRowId, rollupRow,
            dirtyRollupRows = {}, dirtyRollupRow,
            hasDirtyRollupRows = false, headerSubRowsTpl, subRowsTpl, columnsTplData, rowsTplData,
            groups, subRowGroups, subRowHeaderEls, subRowEls, subRowEl, group,
            columnsStore, columnsCount, columnIndex, column, columnId;

        if (!subRowParents) {
            return;
        }

        for (; subRowIndex < subRowsLength; subRowIndex++) {
            subRow = subRows[subRowIndex];
            parentRow = parentRowMapper(subRow, rowsStore);

            if (!parentRow) {
                unmappedSubRows.push(subRow);
                continue;
            }

            parentRowId = parentRow.getId();
            rollupRow = rollupRows[parentRowId];

            subRowParents[subRow.getId()] = parentRow;
            rollupRow.subRows.push(subRow);

            // finish with this subRow if it's rollupRow isn't painted yet
            if (!rollupRow.gridPainted) {
                continue;
            }

            // queue subRow to row's render queue
            dirtyRollupRow = dirtyRollupRows[parentRowId];

            if (!dirtyRollupRow) {
                dirtyRollupRow = dirtyRollupRows[parentRowId] = {
                    rollupRow: rollupRow,
                    newSubRows: []
                };
            }

            dirtyRollupRow.newSubRows.push(subRow);
            hasDirtyRollupRows = true;
        }

        // skip rest of method if no rollupRows need updating
        if (!hasDirtyRollupRows) {
            return;
        }

        headerSubRowsTpl = me.getTpl('headerSubRowsTpl');
        subRowsTpl = me.getTpl('subRowsTpl');
        columnsTplData = (me.getData()||{}).columns || [];
        columnsStore = me.getColumnsStore();
        columnsCount = columnsStore.getCount();

        // WRITE phase: generate tpl data for new rows, render them, and append to existing subgrid bodies
        for (parentRowId in dirtyRollupRows) {
            dirtyRollupRow = dirtyRollupRows[parentRowId];

            subRows = dirtyRollupRow.newSubRows;
            subRowsLength = subRows.length;

            rollupRow = dirtyRollupRow.rollupRow;

            rowsTplData = [];
            for (subRowIndex = 0; subRowIndex < subRowsLength; subRowIndex++) {
                rowsTplData.push(me.buildSubRowTplData(subRows[subRowIndex], columnsTplData));
            }

            headerSubRowsTpl.append(rollupRow.headersEl, rowsTplData);
            subRowsTpl.append(rollupRow.bodyEl, rowsTplData);
        }

        // READ phase: query dom to collect references to key elements
        for (parentRowId in dirtyRollupRows) {
            dirtyRollupRow = dirtyRollupRows[parentRowId];
            subRows = dirtyRollupRow.newSubRows;
            subRowsLength = subRows.length;

            rollupRow = dirtyRollupRow.rollupRow;
            groups = rollupRow.groups;
            subRowHeaderEls = rollupRow.subRowHeaderEls;
            subRowEls = rollupRow.subRowEls;

            for (subRowIndex = 0; subRowIndex < subRowsLength; subRowIndex++) {
                subRow = subRows[subRowIndex];
                subRowId = subRow.getId();
                subRowGroups = groups[subRowId] || (groups[subRowId] = {});

                subRowHeaderEls[subRowId] = rollupRow.headersEl.down('.jarvus-aggregrid-subrow[data-subrow-id="'+subRowId+'"]');
                subRowEl = subRowEls[subRowId] = rollupRow.bodyEl.down('.jarvus-aggregrid-subrow[data-subrow-id="'+subRowId+'"]');

                for (columnIndex = 0; columnIndex < columnsCount; columnIndex++) {
                    column = columnsStore.getAt(columnIndex);
                    columnId = column.getId();

                    group = subRowGroups[columnId] || (subRowGroups[columnId] = {});
                    group.cellEl = subRowEl.down('.jarvus-aggregrid-cell[data-column-id="'+columnId+'"]');
                    group.row = subRow;
                    group.subRowId = subRowId;
                    group.column = column;
                    group.columnId = columnId;
                    group.rendered = group.dirty = false;
                }
            }
        }

        // READ->WRITE phase: sync row heights
        for (parentRowId in dirtyRollupRows) {
            me.syncSubRowHeights(parentRowId);
        }

        // WRITE phase: repaint data
        for (parentRowId in dirtyRollupRows) {
            me.repaintSubCells(parentRowId);
        }

        // READ->WRITE phase: sync expander heights
        for (parentRowId in dirtyRollupRows) {
            me.syncExpanderHeight(parentRowId);
        }
    },

    unmapSubRows: function(subRows) {
        var me = this,
            rollupRows = me.rollupRows,
            subRowParents = me.subRowParents,

            subRowsLength = subRows.length,
            subRowIndex = 0, subRow, subRowId, parentRow, parentRowId, rollupRow, columns,
            columnId, group, groupRecords,
            staleRecords = [],
            repaintSubGrids = {};

        if (!subRowParents) {
            return repaintSubGrids;
        }

        for (; subRowIndex < subRowsLength; subRowIndex++) {
            subRow = subRows[subRowIndex];
            subRowId = subRow.getId();
            parentRow = subRowParents[subRowId];

            delete subRowParents[subRowId];

            if (parentRow) {
                parentRowId = parentRow.getId();
                rollupRow = rollupRows[parentRowId];
                columns = rollupRow.groups[subRowId];

                Ext.Array.remove(rollupRow.subRows, subRow);

                for (columnId in columns) { // eslint-disable-line guard-for-in
                    group = columns[columnId];
                    groupRecords = group.records;

                    if (groupRecords) {
                        Ext.Array.push(staleRecords, Ext.Array.pluck(groupRecords, 'record'));
                    }
                }

                // repaintSubGrids[parentRowId] = true;
            }
        }

        me.ungroupSubRecords(staleRecords, false);

        // TODO: these aren't repaints, they're adding/removing subrows
        // if (repaint !== false) {
        //     for (parentRowId in repaintSubGrids) {
        //         if (rollupRows[parentRowId].cellsPainted) {
        //             me.repaintSubGrid(parentRowId); // TODO: remove row instead of repainting whole subgrid
        //             me.syncExpanderHeight(parentRowId);
        //         }
        //     }
        // }

        return repaintSubGrids;
    },

    remapSubRows: function(subRows) {
        this.refreshGrid(); // TODO: support incremental update
    },

    mapUnmappedSubRows: function() {
        var me = this,
            unmappedSubRows = me.unmappedSubRows;

        if (!unmappedSubRows.length) {
            return;
        }

        me.unmappedSubRows = [];
        me.mapSubRows(unmappedSubRows);
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
            groupedSubRecords = me.groupedSubRecords,
            ungroupedSubRecords = me.ungroupedSubRecords,

            subRowsStore = me.getSubRowsStore(),
            subRowMapper = me.getSubRowMapper(),
            columnsStore = me.getColumnsStore(),
            columnMapper = me.getColumnMapper(),

            subRecordsCount = subRecords.length,
            subRecordIndex = 0, subRecord, subRecordId, subRecordGroupData,
            subRow, subRowId, parentRow, parentRowId, column, columnId, group, groupRecords,
            repaintRows = {};

        if (!groupedSubRecords) {
            return repaintRows;
        }

        for (; subRecordIndex < subRecordsCount; subRecordIndex++) {
            subRecord = subRecords[subRecordIndex];
            subRecordId = subRecord.getId();

            // get target row and column for this record
            subRow = subRowMapper(subRecord, subRowsStore);
            column = columnMapper(subRecord, columnsStore);

            if (!subRow || !parentRow || !column) {
                ungroupedSubRecords.push(subRecord);
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
            group = null;//rollupRows[parentRowId].groups;

            subRowId = subRow.getId();
            // TODO: subRowId is unique enough, we can have a global cache of groups per subRow w/o going through rollupRow['parentRowId].groups
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

        return repaintRows;
    },

    ungroupSubRecords: function(subRecords, repaint) {
        var me = this,
            rollupRows = me.rollupRows,
            groupedSubRecords = me.groupedSubRecords,
            subRecordsLength = subRecords.length,
            i = 0, subRecord, subRecordId, subRecordGroupData, group,
            repaintRows = {}, parentRowId;

        if (!groupedSubRecords) {
            return repaintRows;
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

        return repaintRows;
    },

    regroupSubRecords: function(subRecords, repaint) {
        var me = this,
            subRowParents = me.subRowParents,
            rollupRows = me.rollupRows,
            groupedSubRecords = me.groupedSubRecords,

            subRowsStore = me.getSubRowsStore(),
            subRowMapper = me.getSubRowMapper(),
            columnsStore = me.getColumnsStore(),
            columnMapper = me.getColumnMapper(),

            subRecordsCount = subRecords.length,
            subRecordIndex = 0, subRecord, subRecordId, subRecordGroupData, previousGroup,
            subRow, subRowId, parentRow, parentRowId, column, columnId, group, groupRecords,
            repaintRows = {},
            ungroupedSubRecords = [],
            staleRecords = [];

        if (!groupedSubRecords) {
            return repaintRows;
        }

        for (; subRecordIndex < subRecordsCount; subRecordIndex++) {
            subRecord = subRecords[subRecordIndex];
            subRecordId = subRecord.getId();
            subRecordGroupData = groupedSubRecords[subRecordId];

            if (!subRecordGroupData) {
                ungroupedSubRecords.push(subRecord);
                continue;
            }

            previousGroup = subRecordGroupData.group;

            // get updated target row and column for this record
            subRow = subRowMapper(subRecord, subRowsStore);
            parentRow = subRow && subRowParents[subRow.getId()];
            column = columnMapper(subRecord, columnsStore);

            if (!subRow || !parentRow || !column) {
                staleRecords.push(subRecord);
                continue;
            }

            // check if subRecord needs to be moved to a new group
            if (subRow === subRecordGroupData.subRow && column === subRecordGroupData.column) {
                continue;
            }

            // update subRow and column
            subRecordGroupData.subRow = subRow;
            subRecordGroupData.parentRow = parentRow;
            subRecordGroupData.column = column;

            // get new group
            parentRowId = parentRow.getId();
            group = rollupRows[parentRowId].groups;

            subRowId = subRow.getId();
            group = group[subRowId] || (group[subRowId] = {});

            columnId = column.getId();
            group = group[columnId] || (group[columnId] = {});
            groupRecords = group.records || (group.records = []);

            // move subRecord to new group
            Ext.Array.remove(previousGroup.records, subRecordGroupData);
            subRecordGroupData.previousGroup = previousGroup;
            subRecordGroupData.group = group;
            groupRecords.push(subRecordGroupData);

            // mark both group dirty
            group.dirty = true;
            previousGroup.dirty = true;

            // mark parent row for repaint
            repaintRows[parentRowId] = true;

            me.fireEvent('subrecordregrouped', me, subRecordGroupData, group, previousGroup);
        }

        if (ungroupedSubRecords.length) {
            Ext.apply(repaintRows, me.groupSubRecords(ungroupedSubRecords, false));
        }

        if (staleRecords.length) {
            Ext.apply(repaintRows, me.ungroupSubRecords(staleRecords, false));
        }

        if (repaint !== false) {
            for (parentRowId in repaintRows) {
                if (rollupRows[parentRowId].cellsPainted) {
                    me.repaintSubCells(parentRowId);
                }
            }
        }

        return repaintRows;
    },

    invalidateSubRecordGroups: function(subRecords, repaint) {
        var me = this,
            rollupRows = me.rollupRows,
            groupedSubRecords = me.groupedSubRecords,

            subRecordsLength = subRecords.length,
            i = 0, subRecordGroupData,
            repaintRows = {}, parentRowId;

        if (!groupedSubRecords) {
            return repaintRows;
        }

        for (; i < subRecordsLength; i++) {
            subRecordGroupData = groupedSubRecords[subRecords[i].getId()];

            if (!subRecordGroupData) {
                continue;
            }

            subRecordGroupData.group.dirty = true;

            // mark parent row for repaint
            repaintRows[subRecordGroupData.parentRow.getId()] = true;
        }

        if (repaint !== false) {
            for (parentRowId in repaintRows) {
                if (rollupRows[parentRowId].cellsPainted) {
                    me.repaintSubCells(parentRowId);
                }
            }
        }

        return repaintRows;
    },

    groupUngroupedSubRecords: function(repaint) {
        var me = this,
            ungroupedSubRecords = me.ungroupedSubRecords;

        if (!ungroupedSubRecords.length) {
            return;
        }

        me.ungroupedSubRecords = [];
        return me.groupSubRecords(ungroupedSubRecords, repaint);
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