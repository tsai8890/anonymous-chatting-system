import { MatIconModule } from '@angular/material/icon'
import { Component, ElementRef, signal, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Message } from '../../models/Message';
import { WebsocketService } from '../../service/websocket/websocket.service';
import { CoreService } from '../../service/core/core.service';
import { ExitDialogComponent } from '../exit-dialog/exit-dialog.component';

import {
	MatDialog,
} from '@angular/material/dialog';

@Component({
  selector: 'app-chatroom',
  imports: [FormsModule, MatIconModule],
  templateUrl: './chatroom.component.html',
  styleUrl: './chatroom.component.scss'
})
export class ChatroomComponent {
	messages = signal<Message[]>([]);
	currentMessageID = signal(0);
	inputMessage = '';
	
	@ViewChild('chatContainer') chatContainer!: ElementRef;

	constructor(
		public coreService: CoreService,
		private webSocketService: WebsocketService,
		public exitDialog: MatDialog
	) {}

	ngOnInit(): void {
		this.webSocketService.getMessages().subscribe((message: string) => {
			console.log(message);
			if (message.startsWith('[message]')) {
				// message: '[message] [UID] text'
				let parts = message.split(']');
				let uidFrom = parts[1].slice(2);
				let text = parts[2].slice(1);
				
				if (uidFrom !== this.coreService.uid()) {
					const receivedDate = new Date();
					this.updateMessage({
						text: text,
						messageID: this.currentMessageID(),
						date: receivedDate,
						HMDateStr: `${String(receivedDate.getHours()).padStart(2, '0')}:`
								 + `${String(receivedDate.getMinutes()).padStart(2, '0')}`,
						uidFrom: uidFrom
					} as Message);
				}
			}
			else if (message.startsWith('[system]')) {
				// message: '[system] {system message}
				let systemMessage = message.slice('[system] '.length);

				const receivedDate = new Date();
				this.updateMessage({
					text: systemMessage,
					messageID: this.currentMessageID(),
					date: receivedDate,
					HMDateStr: `${String(receivedDate.getHours()).padStart(2, '0')}:`
							 + `${String(receivedDate.getMinutes()).padStart(2, '0')}`,
					uidFrom: ''
				} as Message);

				if (systemMessage === 'The person has left.') {
					this.coreService.theOtherLeft();
				}
			}
        });
	}

	ngAfterViewChecked() {
		this.scrollToBottom();
	}

	openExitDialog(): void {
		const dialogRef = this.exitDialog.open(
		  	ExitDialogComponent, {
			  	autoFocus: false
		  	}
	  	);
  
	  	dialogRef.afterClosed().subscribe(result => {
		  	if (result !== undefined) {
			  	this.onExit();
		  	}
	  	});
  	}

	scrollToBottom(): void {
		try {
			this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
		} catch (err) {
			console.error('Failed to scroll:', err);
		}
	}

	isInputDisabled(): boolean {
		return this.coreService.inQueue() || this.coreService.isTheOtherLeft();
	}

	updateMessage(message: Message): void {
		let currentMessages = this.messages();
		currentMessages.push(message);

		this.messages.set(currentMessages);
		this.currentMessageID.update(currentMID => currentMID + 1);
	}

	onSendMessage() {
		if (this.inputMessage.length === 0) {
			return;
		}

		const sentDate = new Date();

		this.updateMessage({
			text: this.inputMessage,
			messageID: this.currentMessageID(),
			date: sentDate,
			HMDateStr: `${String(sentDate.getHours()).padStart(2, '0')}:`
					 + `${String(sentDate.getMinutes()).padStart(2, '0')}`,
			uidFrom: this.coreService.uid()
		} as Message)

		this.webSocketService.sendMessage(`[message] ${this.inputMessage}`);
		this.inputMessage = '';
	}

	onExit() {
		this.coreService.init();
		this.webSocketService.closeAndReconnect();
	}
}