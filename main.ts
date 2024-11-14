import { Plugin, Menu, setIcon, normalizePath, Notice, View, TAbstractFile } from 'obsidian';

// 自行声明必要的接口
interface FileExplorerView extends View {
	fileItems: { [key: string]: FileItem };
	revealInFolder: (file: TAbstractFile) => void;
  }
  
  interface FileItem {
	file: TAbstractFile;
	setCollapsed?: (collapsed: boolean) => void;
	createFolder?: () => void;
	createNewNote?: () => void;
	rename?: () => void;
	dom: {
	  entry: HTMLElement;
	};
  }

export default class HoverFolderActionsPlugin extends Plugin {
	async onload() {
		console.log('Hover Folder Actions 插件已加载');

  // 等待工作区布局加载完成，确保文件资源管理器已加载
  this.app.workspace.onLayoutReady(() => {
    // 加载插件的样式文件
    this.loadStyles();

    // 获取文件资源管理器的视图
    const fileExplorerLeaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
    if (!fileExplorerLeaf) return;
    const fileExplorerView = fileExplorerLeaf.view;

    // 获取文件资源管理器的容器元素
    const containerEl = fileExplorerView.containerEl;

    // 绑定事件处理函数，确保引用一致
    const onMouseOver = this.onMouseOver.bind(this);
    const onMouseOut = this.onMouseOut.bind(this);

    // 在容器上绑定 mouseover 和 mouseout 事件，使用事件委托
    containerEl.addEventListener('mouseover', onMouseOver);
    containerEl.addEventListener('mouseout', onMouseOut);

    // 当插件卸载时，移除事件监听器
    this.register(() => {
      containerEl.removeEventListener('mouseover', onMouseOver);
      containerEl.removeEventListener('mouseout', onMouseOut);
    });
  });
	  }

  onunload() {
    console.log('Hover Folder Actions 插件已卸载');
    // 所有资源的清理工作已在 this.register() 调用中处理
  }

   // 鼠标移入事件处理函数
   private onMouseOver(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target && target.classList.contains('nav-folder-title')) {
      this.addIconToFolderTitle(target);
    }
  }

  // 鼠标移出事件处理函数
  private onMouseOut(event: MouseEvent) {
	const target = event.target as HTMLElement;
	const relatedTarget = event.relatedTarget as HTMLElement;
  
	if (target && target.classList.contains('nav-folder-title')) {
	  // 检查 relatedTarget 是否仍在 target 内部
	  if (relatedTarget && target.contains(relatedTarget)) {
		// 鼠标仍在文件夹标题或其子元素上，不移除图标
		return;
	  }
	  // 鼠标已离开文件夹标题，移除图标
	  this.removeIconFromFolderTitle(target);
	}
  }

  async loadStyles() {
	const style = document.createElement('style');
	//创建一个样式表
	style.textContent = `
	.my-plugin-add-icon {
	opacity: 0;
	transition: opacity 0.2s;
	cursor: pointer;
	display: flex;
	align-items: center;
	margin-left: auto; /* 添加这行，将图标推到右侧 */
	}

	.nav-folder-title {
	display: flex;
	align-items: center;
	}

	.nav-folder-title:hover .my-plugin-add-icon {
	opacity: 1;
	}

	.my-plugin-add-icon svg {
	width: 16px; /* 您可以调整图标大小 */
	height: 16px;
	color: var(--icon-color);
	stroke-width: 2px; /* 调整 SVG 线条粗细 */
	}
	`;
	//将样式表添加到head标签中
	document.head.appendChild(style);
	//在插件卸载时，移除添加的样式
	this.register(() => {
	  style.remove();
	});
  }

  
  /**
   * 为单个文件夹标题添加加号图标
   */
  private addIconToFolderTitle(titleEl: HTMLElement) {
	// 防止重复添加图标
	if (titleEl.querySelector('.my-plugin-add-icon')) return;
  
	// 创建加号图标元素
	const addIcon = document.createElement('div');
	addIcon.classList.add('my-plugin-add-icon');
  
	// 设置图标
	setIcon(addIcon, 'circle-plus');
  
	// 将图标添加到文件夹标题元素中
	titleEl.appendChild(addIcon);
  
	// 定义事件处理函数，并赋值给变量
	const clickHandler = (event: MouseEvent) => {
	  event.stopPropagation();
	  event.preventDefault();
	  this.showActionMenu(event, titleEl);
	};
  
	// 为图标添加点击事件监听器
	addIcon.addEventListener('click', clickHandler);
  
	// 在插件卸载时，移除添加的事件监听器和图标
	this.register(() => {
	  addIcon.removeEventListener('click', clickHandler);
	  addIcon.remove();
	});
  }
  

  // 移除文件夹标题上的图标
  private removeIconFromFolderTitle(titleEl: HTMLElement) {
    const addIcon = titleEl.querySelector('.my-plugin-add-icon');
    if (addIcon) {
      addIcon.remove();
    }
  }


  /**
   * 显示操作菜单，提供新建笔记、白板和文件夹的选项
   * @param event 鼠标事件
   * @param titleEl 被点击的文件夹标题元素
   */
  showActionMenu(event: MouseEvent, titleEl: HTMLElement) {
    const menu = new Menu();

    // 从 titleEl 获取 data-path 属性，得到文件夹路径
    const folderPath = titleEl.getAttribute('data-path') || '';
    const normalizedFolderPath = normalizePath(folderPath);
    console.log('folderPath:', normalizedFolderPath);

    if (!normalizedFolderPath) {
      console.error('无法确定文件夹路径。');
      return;
    }

    // 添加 "新建笔记" 菜单项
    menu.addItem((item) => {
      item.setTitle('新建笔记')
        .setIcon('document')
        .onClick(() => {
          this.createNewNoteInFolder(normalizedFolderPath);
        });
    });

    // 添加 "新建白板" 菜单项
    menu.addItem((item) => {
      item.setTitle('新建白板')
        .setIcon('layout')
        .onClick(() => {
          this.createNewCanvasInFolder(normalizedFolderPath);
        });
    });

    // 添加 "新建文件夹" 菜单项
    menu.addItem((item) => {
      item.setTitle('新建文件夹')
        .setIcon('folder')
        .onClick(() => {
          this.createNewFolderInFolder(normalizedFolderPath);
        });
    });

    // 在鼠标位置显示菜单
    menu.showAtMouseEvent(event);
  }

  /**
   * 获取可用的文件路径，避免名称冲突
   * @param folderPath 文件夹路径
   * @param fileName 文件名
   * @returns 可用的文件路径
   */
  private getAvailableFilePath(folderPath: string, fileName: string): string {
	const { vault } = this.app;
	const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
	const baseName = fileName.replace(ext, '');
	let newFileName = fileName;
	let filePath = normalizePath(`${folderPath}/${newFileName}`);
	let i = 1;
  
	while (vault.getAbstractFileByPath(filePath)) {
	  newFileName = `${baseName} ${i}${ext}`;
	  filePath = normalizePath(`${folderPath}/${newFileName}`);
	  i++;
	}
	return filePath;
  }

  /**
   * 创建新笔记文件，并在创建后展开文件夹
   * @param folderPath 文件夹路径
   */
  createNewNoteInFolder(folderPath: string) {
    console.log('Creating new note in folderPath:', folderPath);
    this.createNewFile(folderPath, '未命名笔记.md').then(() => {
      // 创建完成后，展开文件夹
      this.expandFolderInFileExplorer(folderPath);
    });
  }

  /**
   * 创建新白板文件，并在创建后展开文件夹
   * @param folderPath 文件夹路径
   */
  createNewCanvasInFolder(folderPath: string) {
    console.log('Creating new canvas in folderPath:', folderPath);
    this.createNewFile(folderPath, '未命名白板.canvas').then(() => {
      // 创建完成后，展开文件夹
      this.expandFolderInFileExplorer(folderPath);
    });
  }

  /**
 * 创建新文件夹，并进入重命名模式
 * @param folderPath 父文件夹路径
 */
  createNewFolderInFolder(folderPath: string) {
	const newFolderName = '新建文件夹';
	let uniqueFolderName = newFolderName;
	let i = 1;
  
	let newFolderPath = normalizePath(`${folderPath}/${uniqueFolderName}`);
  
	// 检查文件夹是否存在，若存在则添加数字后缀
	while (this.app.vault.getAbstractFileByPath(newFolderPath)) {
	  uniqueFolderName = `${newFolderName} ${i}`;
	  newFolderPath = normalizePath(`${folderPath}/${uniqueFolderName}`);
	  i++;
	}
  
	console.log('Creating folder at:', newFolderPath);
  
	// 创建新文件夹
	this.app.vault.createFolder(newFolderPath).then((newFolder) => {
	  // 展开父文件夹
	  this.expandFolderInFileExplorer(folderPath);
	  // 展开新创建的文件夹
	//this.expandFolderInFileExplorer(newFolderPath);
  
	  // 选中新创建的文件夹
	  this.selectFolderInFileExplorer(newFolderPath);
  
	}).catch((error) => {
	  console.error('Error creating folder:', error);
	  new Notice('创建文件夹失败，请检查控制台日志获取详细信息。');
	});
  }
  
  /**
   * 通过进入重命名状态来选中文件夹
   * @param folderPath 文件夹路径
   */
  private selectFolderInFileExplorer(folderPath: string) {
	const fileExplorerLeaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
	if (!fileExplorerLeaf) return;
  
	const fileExplorerView = fileExplorerLeaf.view as FileExplorerView;
	const folderItem = fileExplorerView.fileItems[folderPath];
  
	if (folderItem) {
	  // 在文件浏览器中高亮显示该文件夹
	//   fileExplorerView.revealInFolder(folderItem.file);
	  
	  setTimeout(() => {
		const folderEl = fileExplorerView.containerEl.querySelector(`[data-path="${folderPath}"]`);
		if (folderEl) {
		  // 1. 先触发 Alt+Click 选中文件夹
		  folderEl.dispatchEvent(new MouseEvent('click', {
			altKey: true,
			bubbles: true,
			cancelable: true,
			view: window
		  }));
		  
		  // 2. 然后触发 F2 进入重命名状态
		  folderEl.dispatchEvent(new KeyboardEvent('keydown', {
			key: 'F2',
			code: 'F2',
			bubbles: true
		  }));
		}
	  }, 100);
	}
  }

  /**
   * 通用的创建新文件的方法
   * @param folderPath 文件夹路径
   * @param fileName 文件名
   * @param openAfterCreate 是否在创建后打开
   * @returns Promise<void>
   */
  private createNewFile(folderPath: string, fileName: string, openAfterCreate: boolean = true): Promise<void> {
    return new Promise((resolve, reject) => {
      const filePath = this.getAvailableFilePath(folderPath, fileName);
      console.log('Creating file at:', filePath);

      // 创建新文件
      this.app.vault.create(filePath, '').then((file) => {
        if (openAfterCreate) {
          // 打开新创建的文件
          this.app.workspace.getLeaf(true).openFile(file);
        }
        resolve();
      }).catch((error) => {
        console.error('Error creating file:', error);
        reject(error);
      });
    });
  }

  /**
   * 在文件资源管理器中展开指定路径的文件夹
   * @param folderPath 要展开的文件夹路径
   */
  private expandFolderInFileExplorer(folderPath: string) {
    const fileExplorerLeaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
    if (!fileExplorerLeaf) return;
    const fileExplorerView = fileExplorerLeaf.view as FileExplorerView;

    // 获取对应的文件夹项
    const folderItem = fileExplorerView.fileItems[folderPath];
    if (folderItem && typeof folderItem.setCollapsed === 'function') {
      folderItem.setCollapsed(false);
    } else {
      console.warn(`Folder item not found or doesn't support collapsing: ${folderPath}`);
    }
  }
}
