Ext.define('Jarvus.aggregrid.Aggregrid', {
    extend: 'Ext.Component',


    config: {
        columnsStore: null,
        rowsStore: null,

        columnHeaderField: 'title',
        columnHeaderTpl: false,

        rowHeaderField: 'title',
        rowHeaderTpl: false,

        componentCls: 'jarvus-aggregrid',

    //     data: {
    //         columns: [
    //             { fullName: 'Jessica Alfred' },
    //             { fullName: 'Christian Bumble' },
    //             { fullName: 'David Calloway' },
    //             { fullName: 'William Christianson' },
    //             { fullName: 'Christian Davids' },
    //             { fullName: 'Johnathan Fazio' },
    //             { fullName: 'Tyler Fellows' },
    //             { fullName: 'Jessica Alfred' },
    //             { fullName: 'Christian Bumble' },
    //             { fullName: 'David Calloway' },
    //             { fullName: 'William Christianson' },
    //             { fullName: 'Christian Davids' },
    //             { fullName: 'Johnathan Fazio' },
    //             { fullName: 'Tyler Fellows' },
    //             { fullName: 'Jessica Alfred' },
    //             { fullName: 'Christian Bumble' },
    //             { fullName: 'David Calloway' },
    //             { fullName: 'William Christianson' },
    //             { fullName: 'Christian Davids' },
    //             { fullName: 'Johnathan Fazio' },
    //             { fullName: 'Tyler Fellows' },
    //             { fullName: 'Nafis Guthery' }
    //         ],
    //         rows: [
    //             {
    //                 title: 'Performance Task 1',
    //                 students: [
    //                     { text: 'Foo' },
    //                     { text: 'Foole' },
    //                     { text: 'Foo' },
    //                     { text: 'Fooianson' },
    //                     { text: 'Foods' },
    //                     { text: 'Fooo' },
    //                     { text: 'Foo' },
    //                     { text: 'Foo' },
    //                     { text: 'Foole' },
    //                     { text: 'Foo' },
    //                     { text: 'Fooianson' },
    //                     { text: 'Foods' },
    //                     { text: 'Fooo' },
    //                     { text: 'Foo' },
    //                     { text: 'Foo' },
    //                     { text: 'Foole' },
    //                     { text: 'Foo' },
    //                     { text: 'Fooianson' },
    //                     { text: 'Foods' },
    //                     { text: 'Fooo' },
    //                     { text: 'Foo' },
    //                     { text: 'Foo' }
    //                 ],
    //                 rows: [
    //                     {
    //                         title: 'Performance Task 1, Subtask 1',
    //                         students: [
    //                             { text: 'Foo' },
    //                             { text: 'Foole' },
    //                             { text: 'Foo' },
    //                             { text: 'Fooianson' },
    //                             { text: 'Foods' },
    //                             { text: 'Fooo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foole' },
    //                             { text: 'Foo' },
    //                             { text: 'Fooianson' },
    //                             { text: 'Foods' },
    //                             { text: 'Fooo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foole' },
    //                             { text: 'Foo' },
    //                             { text: 'Fooianson' },
    //                             { text: 'Foods' },
    //                             { text: 'Fooo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foo' }
    //                         ]
    //                     },
    //                     {
    //                         title: 'Performance Task 1, Subtask 2',
    //                         students: [
    //                             { text: 'Foo' },
    //                             { text: 'Foole' },
    //                             { text: 'Foo' },
    //                             { text: 'Fooianson' },
    //                             { text: 'Foods' },
    //                             { text: 'Fooo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foole' },
    //                             { text: 'Foo' },
    //                             { text: 'Fooianson' },
    //                             { text: 'Foods' },
    //                             { text: 'Fooo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foole' },
    //                             { text: 'Foo' },
    //                             { text: 'Fooianson' },
    //                             { text: 'Foods' },
    //                             { text: 'Fooo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foo' }
    //                         ]
    //                     },
    //                     {
    //                         title: 'Performance Task 1, Subtask 3',
    //                         students: [
    //                             { text: 'Foo' },
    //                             { text: 'Foole' },
    //                             { text: 'Foo' },
    //                             { text: 'Fooianson' },
    //                             { text: 'Foods' },
    //                             { text: 'Fooo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foole' },
    //                             { text: 'Foo' },
    //                             { text: 'Fooianson' },
    //                             { text: 'Foods' },
    //                             { text: 'Fooo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foole' },
    //                             { text: 'Foo' },
    //                             { text: 'Fooianson' },
    //                             { text: 'Foods' },
    //                             { text: 'Fooo' },
    //                             { text: 'Foo' },
    //                             { text: 'Foo' }
    //                         ]
    //                     },
    //                 ]
    //             },
    //             {
    //                 title: 'Performance Task 2',
    //                 students: [
    //                     { text: 'Foo' },
    //                     { text: 'Foole' },
    //                     { text: 'Foo' },
    //                     { text: 'Fooianson' },
    //                     { text: 'Foods' },
    //                     { text: 'Fooo' },
    //                     { text: 'Foo' },
    //                     { text: 'Foo' },
    //                     { text: 'Foole' },
    //                     { text: 'Foo' },
    //                     { text: 'Fooianson' },
    //                     { text: 'Foods' },
    //                     { text: 'Fooo' },
    //                     { text: 'Foo' },
    //                     { text: 'Foo' },
    //                     { text: 'Foole' },
    //                     { text: 'Foo' },
    //                     { text: 'Fooianson' },
    //                     { text: 'Foods' },
    //                     { text: 'Fooo' },
    //                     { text: 'Foo' },
    //                     { text: 'Foo' }
    //                 ],
    //             }
    //         ]
    //     },
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

    doRefresh: function() {
        console.info('doRefresh');

        this.setData(this.buildTplData());
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