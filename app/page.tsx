'use client'

require('dotenv').config({ path: '.env.local' });
import dynamic from 'next/dynamic'
import '@tldraw/tldraw/tldraw.css'
import { MakeRealButton } from './components/MakeRealButton'
import { TldrawLogo } from './components/TldrawLogo'
import { ResponseShapeUtil } from './ResponseShape/ResponseShape'
import { RiskyButCoolAPIKeyInput } from './components/RiskyButCoolAPIKeyInput'
import { OverlayKeyboard } from './components/OverlayKeyboard'
import { NodeShapeUtil } from './NodeShape/NodeShape'
import { NodeShapeTool } from './NodeShape/NodeShapeTool'
import FontDownloadIcon from '@mui/icons-material/FontDownload'
import { uiOverrides } from './ui-overrides'
import { QuilEditorShapeUtil } from './QuilEditorShape/QuilEditorShape'
import {
	TLUiAssetUrlOverrides,
	TLEventInfo,
	TLUiEventHandler,
	TLEditorComponents,
	useEditor,
	track,
	stopEventPropagation,
} from '@tldraw/tldraw'
import { TopZoneNameBar } from './components/TopZoneNameBar'
import { useCallback, useEffect, useState } from 'react'
import {
	TaskSplitResponseShapeUtil,
	SubTaskShapeUtil,
} from './TaskSplitResponseShape/TaskSplitResponseShape'
import { ResultShapeUtil } from './ResultShape/ResultShapeUtil'
import { IconButton } from '@mui/material'
import { FrameShapeUtil } from './FrameShape/FrameShapeUtil'
import { FrameShapeTool } from './FrameShape/FrameShapeTool'
import { useYjsStore } from './useYjsStore'
import { SearchShapeUtil } from './SearchShape/SearchShape';
import { SearchTool } from './SearchShape/SearchShapeTool';
import { GroupMenu } from './components/GroupMenu'

const Tldraw = dynamic(async () => (await import('@tldraw/tldraw')).Tldraw, {
	ssr: false,
})

const customShapeUtils = [
	ResponseShapeUtil,
	NodeShapeUtil,
	TaskSplitResponseShapeUtil,
	SubTaskShapeUtil,
	QuilEditorShapeUtil,
	SearchShapeUtil,
	FrameShapeUtil,
	ResultShapeUtil
]
const customTools = [NodeShapeTool, FrameShapeTool, SearchTool]

const customAssetUrls: TLUiAssetUrlOverrides = {
	icons: {
		node: '/note-sticky-solid.svg',
		new_frame: '/frame.png',
		search: '/search.png',
	},
}

const WS_ADDRESS = "104.154.83.173"
const WS_PORT = "5800"

const HOST_URL =
	process.env.NODE_ENV === 'development'
		? `ws://${WS_ADDRESS}:${WS_PORT}`
		: 'wss://demos.yjs.dev'

const components: Partial<TLEditorComponents> = {
	OnTheCanvas: null,
	InFrontOfTheCanvas: null,
	SnapLine: null,
}

const FeatureMenu = track(() => {
	const editor = useEditor()

	const { color, name } = editor.user

	return (
		<div style={{ pointerEvents: 'all', display: 'flex' }}>
			<GroupMenu editor={editor} />
			{/* <input
				type="color"
				value={color}
				onChange={(e) => {
					editor.user.updateUserPreferences({
						color: e.currentTarget.value,
					})
				}}
			/>
			<input
				value={name}
				onChange={(e) => {
					editor.user.updateUserPreferences({
						name: e.currentTarget.value,
					})
				}}
			/>
			<div>
				<button onPointerDown={stopEventPropagation} onClick={() => {
					const records = editor.store.allRecords()
					console.log("records: ", records)
					
				}}>Create User</button>
			</div> */}
		</div>
	)
})

export default function App() {
	const [uiEvents, setUiEvents] = useState<string[]>([])
	const [isPointerPressed, setIsPointerPressed] = useState(false)
	const [editor, setEditor] = useState(null)
	const [user, setUser] = useState()

	// const handleUiEvent = useCallback<TLUiEventHandler>((name, data) => {
	// 	console.log('Name: ', name)
	// 	setUiEvents(events => [`${name} ${JSON.stringify(data)}`, ...events])
	// }, [])

	const handleEvent = useCallback((data: TLEventInfo, editor: any) => {
		if (data.name == 'pointer_down') {
			setIsPointerPressed(true)
		}
		if (data.name == 'pointer_up') {
			setIsPointerPressed(false)
		}
	}, [])

	const onDragOver = (event) => {
		console.log("onDropOver called")
		event.preventDefault();
	};

	const onDrop = (event) => {
		console.log("onDrop called")
	};

	useEffect(() => {
		const timer = setTimeout(() => {
			if (isPointerPressed == true) {
				const allowedTypes = ['node', 'subtask']
				if (editor) {
					console.log('Pressed for 1 second')
					console.log('editor: ', editor)
					const shapes = editor.getSelectedShapes()
					// Current only support single shape selection
					if (shapes.length > 0 && allowedTypes.includes(shapes[0].type)) {
						const type = shapes[0].type
						const id = shapes[0].id
						editor.updateShapes([
							{
								id,
								type,
								props: {
									isPressed: true,
								},
							},
						])
						console.log('Shape Id: ', shapes[0].id)
					}
				}
			}
		}, 1000)

		return () => clearTimeout(timer)
	}, [isPointerPressed])

	const store = useYjsStore({
		roomId: 'example17',
		hostUrl: HOST_URL,
		shapeUtils: customShapeUtils
	})

	return (
		<div className='editor'>
			<Tldraw
				// persistenceKey="make-real"
				// shareZone={<MakeRealButton />}
				shareZone={<FeatureMenu />}
				// topZone={<TopZoneNameBar editor={editor} />}
				shapeUtils={customShapeUtils}
				tools={customTools}
				overrides={uiOverrides}
				assetUrls={customAssetUrls}O 
				// onUiEvent={handleUiEvent}
				components={components}
				onMount={editor => {
					editor.on('event', event => {
						setEditor(editor)
						handleEvent(event, editor)
					})

					editor.getInitialMetaForShape = (shape) => {
						if (shape.type === 'new_frame') {
							return { isPanelOpen: false, requirements: [], ai_dims: [], loadingStatus: "idle", relationLoadingStatus: "idle", betweenFrameRelations: null }
						}
						
					}
				}}
				//store={store}
				onDragOver={onDragOver}
				onDrop={onDrop}
			>
				{/* <TldrawLogo /> */}
			</Tldraw>
		</div>
	)
}
