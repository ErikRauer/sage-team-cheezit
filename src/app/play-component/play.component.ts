import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {DeckService} from "../deck/deck.service";
import {ActivatedRoute, Router} from "@angular/router";
import {CardState} from "./CardState";
import {AngularFireDatabase} from "angularfire2/database";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef, MatSnackBar} from "@angular/material";
import * as firebase from 'firebase/app';
import 'rxjs/add/operator/take';


@Component({
    selector: 'app-play',
    templateUrl: './play.component.html',
    styleUrls: ['./play.component.scss'],
})
export class PlayComponent implements OnInit, OnDestroy {

    deckId: string;

    private _pageNumber: number = 0;

    public get pageNumber(): number {
        return this._pageNumber;
    }

    public set pageNumber(i: number) {
        let oldI = this._pageNumber;
        this._pageNumber = i;
        if (i != oldI) {
            this.updateGame();
        }

    }

    public pageCount: number = 0;

    public points: number = 0;

    public multiplayer: boolean = false;

    public gameId: string;

    public cardStates: CardState[];

    public gameURL: string;


    // from https://stackoverflow.com/a/41993719/8855259

    randNumDigits(digits: number) {
        return Math.floor(Math.random() * parseInt('8' + '9'.repeat(digits - 1)) + parseInt('1' + '0'.repeat(digits - 1)));
    }


    constructor(public deckService: DeckService, private route: ActivatedRoute,
                private db: AngularFireDatabase, public dialog: MatDialog,
                private router: Router, public snackBar: MatSnackBar) {
    }

    public updateGame(): Promise<void> {
        if (this.cardStates.length == 0) return Promise.reject("no cards");
        if (!this.gameId) return Promise.reject("Game does not exist");
        return this.db.object('games/' + this.gameId).set({
            card: this.cardStates[this.pageNumber].playCard,
            points: this.points,
            selectedHints: this.cardStates[this.pageNumber].selectedCardHints,
            emoji: this.cardStates[this.pageNumber].emoji
        });
    }


    public addPoints(pageNumber: number): void {

        if (this.cardStates[pageNumber].isComplete == false && pageNumber < this.cardStates.length) {
            this.points += this.cardStates[pageNumber].cardPoints;
            this.cardStates[pageNumber].selectedCardHints = [];
            this.cardStates[pageNumber].isDone();
            if (pageNumber < this.cardStates.length - 1) this.pageNumber = pageNumber + 1;
            else this.updateGame();
        }
        //this.updateGame();
    }

    public updateEmoji(emoji: string, i: number) {
        this.cardStates[i].emoji = emoji;
        this.db.object('games/' + this.gameId).update({
            emoji: emoji
        });
    }

    // from https://stackoverflow.com/a/12646864/8855259
    shuffleArray(array: any[]) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }


    ngOnInit() {

        this.route.params.subscribe(params => {
            this.deckId = params['deck'];

            this.deckService.getDeckPlayCards(this.deckId).take(1).subscribe(cards => { //take(1) means we are only getting it once so later changes don't apply
                this.cardStates = cards.map(c => new CardState(c)); // maps incoming cards into card states
                this.shuffleArray(this.cardStates);
            });
        });
    }

    ngOnDestroy() {
        if (this.gameId)
            this.db.object('games/' + this.gameId).remove();
    }

    showGameId() {

        if (!this.multiplayer) {
            this.gameId = this.randNumDigits(6).toString();
            this.gameURL = document.location.origin + this.router.createUrlTree(['/joingame'], {queryParams: {id: this.gameId}}).toString();


            const ref = firebase.database().ref('games').child(this.gameId);
            ref.onDisconnect().remove().then(() => {
                return this.updateGame();
            }).then(() => {
                this.multiplayer = true;
                this.dialog.open(GameJoinDialogComponent, {
                    data: {gameId: this.gameId, gameURL: this.gameURL},
                })
            }).catch(() => {
                this.snackBar.open("Error starting game", null, {
                    duration: 2000,
                });
            })
        } else {
            this.dialog.open(GameJoinDialogComponent, {
                data: {gameId: this.gameId, gameURL: this.gameURL},
            })
        }
    }

}

// a style for this is in the main styles.scss to be able to center the qr code
@Component({
    selector: 'app-game-id-dialog',
    template: '<h2 mat-dialog-title>Game ID</h2>' +
    '<mat-dialog-content>' +
    '<h1 style="text-align: center;">{{this.data.gameId}}</h1>' +
    '<ngx-qrcode class="play-game-id-qrcode" qrc-element-type="url" [qrc-value]="this.data.gameURL"></ngx-qrcode>' +
    '</mat-dialog-content>' +
    '<mat-dialog-actions align="end">' +
    '<button mat-button *ngIf="!this.canShare" ngxClipboard [cbContent]="this.data.gameURL" matTooltip="Copy URL"><mat-icon>content_copy</mat-icon></button>' +
    '<button mat-button *ngIf="this.canShare" (click)="this.browserShareInvite()"><mat-icon>share</mat-icon></button>' +
    '<button mat-button mat-dialog-close>Close</button>' +
    '</mat-dialog-actions>'
})
export class GameJoinDialogComponent {

    constructor(public dialogRef: MatDialogRef<GameJoinDialogComponent>,
                @Inject(MAT_DIALOG_DATA) public data: { gameId: string, gameURL: string }) {
    }


    browserShareInvite() {
        if (navigator.share) {
            navigator.share({
                title: 'Invite to SAGE game',
                url: this.data.gameURL,
            });
        }
    }

    canShare = navigator.share;

}
